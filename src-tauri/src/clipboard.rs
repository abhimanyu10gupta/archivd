use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

/// Save clipboard, simulate Cmd+C, read selection, restore clipboard.
pub fn capture_selection() -> Result<String, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;

    let original = clipboard.get_text().ok();

    simulate_copy()?;

    thread::sleep(Duration::from_millis(200));

    let captured = clipboard.get_text().map_err(|e| {
        format!("Failed to read clipboard after copy: {e}. Make sure text is selected.")
    })?;

    if let Some(ref orig) = original {
        let _ = clipboard.set_text(orig);
    }

    if captured.trim().is_empty() {
        return Err("No text captured. Highlight text before pressing the hotkey.".into());
    }

    Ok(captured)
}

fn simulate_copy() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;

    enigo
        .key(Key::Meta, Direction::Press)
        .map_err(|e| e.to_string())?;
    enigo
        .key(Key::Unicode('c'), Direction::Click)
        .map_err(|e| e.to_string())?;
    enigo
        .key(Key::Meta, Direction::Release)
        .map_err(|e| e.to_string())?;

    Ok(())
}
