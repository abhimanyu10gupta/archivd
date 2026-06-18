mod archive;
mod clipboard;
mod filesystem;
mod metadata;
mod settings;
mod source;

use settings::{load_settings, save_settings, AppSettings};
use source::CaptureMetadata;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

static CAPTURING: AtomicBool = AtomicBool::new(false);
static CAPTURE_ID: AtomicU64 = AtomicU64::new(0);

struct CaptureGuard;

impl Drop for CaptureGuard {
    fn drop(&mut self) {
        CAPTURING.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
fn capture_clipboard() -> Result<String, String> {
    clipboard::capture_selection()
}

#[tauri::command]
fn list_projects() -> Result<Vec<String>, String> {
    filesystem::list_projects()
}

#[tauri::command]
fn list_markdown_files(project: String) -> Result<Vec<String>, String> {
    filesystem::list_markdown_files(&project)
}

#[tauri::command]
fn save_entry(
    project: String,
    file: String,
    text: String,
    metadata: CaptureMetadata,
) -> Result<(), String> {
    filesystem::save_entry(&project, &file, &text, &metadata)
}

#[tauri::command]
fn get_settings() -> AppSettings {
    load_settings()
}

#[tauri::command]
fn save_settings_cmd(settings: AppSettings) -> Result<(), String> {
    save_settings(&settings)
}

#[tauri::command]
fn ensure_base_dir() -> Result<(), String> {
    filesystem::ensure_base_dir()
}

#[tauri::command]
fn hide_window(app: AppHandle, label: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{label}' not found"))?;
    window.hide().map_err(|e| e.to_string())?;

    if label == "dashboard" {
        #[cfg(target_os = "macos")]
        let _ = app.set_dock_visibility(false);
    }

    Ok(())
}

#[tauri::command]
fn load_clips() -> Result<Vec<archive::Clip>, String> {
    archive::load_all_clips()
}

#[tauri::command]
fn toggle_star(clip_id: String) -> Result<bool, String> {
    archive::toggle_star(&clip_id)
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    archive::open_path(&path)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    archive::open_url(&url)
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    archive::reveal_in_finder(&path)
}

#[tauri::command]
fn open_base_dir() -> Result<(), String> {
    let base = settings::base_dir();
    archive::reveal_in_finder(&base.to_string_lossy())
}

fn show_popup(app: &AppHandle, text: String, metadata: CaptureMetadata) -> Result<(), String> {
    let popup = app
        .get_webview_window("popup")
        .ok_or("Popup window not found")?;

    let id = CAPTURE_ID.fetch_add(1, Ordering::SeqCst);
    popup
        .emit(
            "show-popup",
            serde_json::json!({
                "text": text,
                "id": id,
                "metadata": metadata,
            }),
        )
        .map_err(|e| e.to_string())?;

    popup.center().map_err(|e| e.to_string())?;
    popup.show().map_err(|e| e.to_string())?;
    popup.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

fn show_dashboard(app: &AppHandle) -> Result<(), String> {
    let dashboard = app
        .get_webview_window("dashboard")
        .ok_or("Dashboard window not found")?;

    dashboard.center().map_err(|e| e.to_string())?;
    dashboard.show().map_err(|e| e.to_string())?;
    dashboard.set_focus().map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    let _ = app.set_dock_visibility(true);

    dashboard
        .emit("dashboard-opened", ())
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn show_settings(app: &AppHandle) -> Result<(), String> {
    show_dashboard(app)?;
    app.get_webview_window("dashboard")
        .ok_or("Dashboard window not found")?
        .emit("navigate", "settings")
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn trigger_capture(app: &AppHandle) {
    if CAPTURING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    let app = app.clone();
    if let Err(e) = app.clone().run_on_main_thread(move || {
        let _guard = CaptureGuard;

        // Hide popup so focus returns to the app the user was in
        if let Some(popup) = app.get_webview_window("popup") {
            let _ = popup.hide();
        }

        // Brief pause for macOS to restore focus before detecting source
        std::thread::sleep(Duration::from_millis(80));

        let metadata = source::detect_frontmost_source();

        match clipboard::capture_selection() {
            Ok(text) => {
                if let Err(e) = show_popup(&app, text, metadata) {
                    eprintln!("Failed to show popup: {e}");
                }
            }
            Err(e) => {
                eprintln!("Clipboard capture failed: {e}");
                let _ = show_popup(&app, String::new(), metadata);
            }
        }
    }) {
        eprintln!("Failed to dispatch capture to main thread: {e}");
        CAPTURING.store(false, Ordering::SeqCst);
    }
}

fn register_hotkey(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyA);
    let app_handle = app.clone();

    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            trigger_capture(&app_handle);
        }
    })?;

    // app.global_shortcut().register(shortcut)?;

    Ok(())
}

fn build_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let dashboard_item = MenuItem::with_id(app, "dashboard", "Dashboard", true, None::<&str>)?;
    let capture = MenuItem::with_id(app, "capture", "Capture (⌘⇧A)", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&dashboard_item, &capture, &settings_item, &quit])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "dashboard" => {
                let _ = show_dashboard(app);
            }
            "capture" => trigger_capture(app),
            "settings" => {
                let _ = show_settings(app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = show_dashboard(app);
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            let _ = app.set_dock_visibility(false);

            let _ = filesystem::ensure_base_dir();
            if filesystem::list_projects().unwrap_or_default().is_empty() {
                let _ = filesystem::create_sample_structure();
            }

            build_tray(app.handle())?;
            register_hotkey(app.handle())?;

            hide_on_close(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture_clipboard,
            list_projects,
            list_markdown_files,
            save_entry,
            get_settings,
            save_settings_cmd,
            ensure_base_dir,
            hide_window,
            load_clips,
            toggle_star,
            open_path,
            open_url,
            reveal_in_finder,
            open_base_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn hide_on_close(app: &AppHandle) {
    for label in ["popup", "settings", "dashboard"] {
        if let Some(window) = app.get_webview_window(label) {
            let w = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = w.hide();
                }
            });
        }
    }
}
