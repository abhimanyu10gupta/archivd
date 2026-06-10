use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureMetadata {
    pub source_app: String,
    pub source_name: String,
    pub url: Option<String>,
    pub window_title: Option<String>,
}

impl CaptureMetadata {
    pub fn fallback() -> Self {
        Self {
            source_app: "Unknown".to_string(),
            source_name: "Clipboard".to_string(),
            url: None,
            window_title: None,
        }
    }
}

pub fn detect_frontmost_source() -> CaptureMetadata {
    #[cfg(target_os = "macos")]
    {
        macos::detect()
    }
    #[cfg(not(target_os = "macos"))]
    {
        CaptureMetadata::fallback()
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::{CaptureMetadata, browser, resolve_source_name, sanitize_window_title};
    use core_foundation::array::CFArray;
    use core_foundation::base::{CFType, TCFType};
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::number::CFNumber;
    use core_foundation::string::CFString;
    use core_graphics::window::{
        kCGNullWindowID, kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly,
        CGWindowListCopyWindowInfo,
    };
    use objc2_app_kit::NSWorkspace;
    use std::ffi::c_void;

    pub fn detect() -> CaptureMetadata {
        let workspace = NSWorkspace::sharedWorkspace();
        let Some(app) = workspace.frontmostApplication() else {
            return CaptureMetadata::fallback();
        };

        let raw_app = app
            .localizedName()
            .map(|name| name.to_string())
            .unwrap_or_default();

        if raw_app.is_empty() || raw_app.eq_ignore_ascii_case("archivd") {
            return CaptureMetadata::fallback();
        }

        let source_app = raw_app.clone();
        let pid = app.processIdentifier();

        let mut url = None;
        let mut window_title = window_title_for_pid(pid)
            .map(|t| sanitize_window_title(&t, &raw_app))
            .filter(|t| !t.is_empty());

        if let Some(tab) = browser::active_tab_for_app(&raw_app) {
            if !tab.url.is_empty() {
                url = Some(tab.url);
            }
            if window_title.is_none() && !tab.title.is_empty() {
                window_title = Some(sanitize_window_title(&tab.title, &raw_app));
            }
        }

        let source_name = resolve_source_name(&source_app, url.as_deref(), window_title.as_deref());

        CaptureMetadata {
            source_app,
            source_name,
            url,
            window_title,
        }
    }

    fn window_title_for_pid(pid: i32) -> Option<String> {
        unsafe {
            let windows = CGWindowListCopyWindowInfo(
                kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
                kCGNullWindowID,
            );
            if windows.is_null() {
                return None;
            }

            let windows = CFArray::<CFDictionary<CFString, CFType>>::wrap_under_create_rule(
                windows as *const _,
            );

            let mut best: Option<(i32, String)> = None;

            for window in windows.iter() {
                let dict = window;

                let owner_pid = dict
                    .find(cg_window_owner_pid_key())
                    .and_then(|v| cf_number_to_i32(v.as_CFTypeRef() as *const c_void));

                if owner_pid != Some(pid) {
                    continue;
                }

                let layer = dict
                    .find(cg_window_layer_key())
                    .and_then(|v| cf_number_to_i32(v.as_CFTypeRef() as *const c_void))
                    .unwrap_or(-1);

                if layer != 0 {
                    continue;
                }

                let Some(title) = dict
                    .find(cg_window_name_key())
                    .and_then(|v| cf_string_to_string(v.as_CFTypeRef() as *const c_void))
                else {
                    continue;
                };

                let trimmed = title.trim();
                if trimmed.is_empty() {
                    continue;
                }

                let score = trimmed.len() as i32;
                if best.as_ref().map(|(s, _)| score > *s).unwrap_or(true) {
                    best = Some((score, trimmed.to_string()));
                }
            }

            best.map(|(_, title)| title)
        }
    }

    fn cf_number_to_i32(ptr: *const c_void) -> Option<i32> {
        if ptr.is_null() {
            return None;
        }
        unsafe {
            let number = CFNumber::wrap_under_get_rule(ptr as _);
            number.to_i32()
        }
    }

    fn cf_string_to_string(ptr: *const c_void) -> Option<String> {
        if ptr.is_null() {
            return None;
        }
        unsafe {
            let s = CFString::wrap_under_get_rule(ptr as _);
            Some(s.to_string())
        }
    }

    fn cg_window_owner_pid_key() -> CFString {
        CFString::from_static_string("kCGWindowOwnerPID")
    }

    fn cg_window_layer_key() -> CFString {
        CFString::from_static_string("kCGWindowLayer")
    }

    fn cg_window_name_key() -> CFString {
        CFString::from_static_string("kCGWindowName")
    }
}

#[cfg(target_os = "macos")]
mod browser {
    use std::process::Command;

    pub struct BrowserTab {
        pub url: String,
        pub title: String,
    }

    pub fn active_tab_for_app(app_name: &str) -> Option<BrowserTab> {
        let script = match app_name {
            "Google Chrome" => Some(chrome_script()),
            "Safari" => Some(safari_script()),
            "Arc" => Some(arc_script()),
            _ => None,
        }?;

        let output = run_osascript(&script)?;
        parse_tab_output(&output)
    }

    fn chrome_script() -> String {
        r#"tell application "Google Chrome"
  if (count of windows) = 0 then return ""
  set tabUrl to URL of active tab of front window
  set tabTitle to title of active tab of front window
  return tabUrl & linefeed & tabTitle
end tell"#
            .to_string()
    }

    fn safari_script() -> String {
        r#"tell application "Safari"
  if (count of windows) = 0 then return ""
  set tabUrl to URL of current tab of front window
  set tabTitle to name of current tab of front window
  return tabUrl & linefeed & tabTitle
end tell"#
            .to_string()
    }

    fn arc_script() -> String {
        r#"tell application "Arc"
  if (count of windows) = 0 then return ""
  set tabUrl to URL of active tab of front window
  set tabTitle to title of active tab of front window
  return tabUrl & linefeed & tabTitle
end tell"#
            .to_string()
    }

    fn run_osascript(script: &str) -> Option<String> {
        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    }

    fn parse_tab_output(output: &str) -> Option<BrowserTab> {
        let mut lines = output.lines();
        let url = lines.next()?.trim().to_string();
        let title = lines.next().unwrap_or("").trim().to_string();

        if url.is_empty() {
            return None;
        }

        Some(BrowserTab { url, title })
    }
}

fn normalize_app_name(name: &str) -> String {
    match name {
        "Google Chrome" => "Chrome".to_string(),
        "Microsoft Edge" => "Edge".to_string(),
        "Visual Studio Code" => "VS Code".to_string(),
        "Code" => "VS Code".to_string(),
        other => other.to_string(),
    }
}

fn resolve_source_name(
    source_app: &str,
    url: Option<&str>,
    window_title: Option<&str>,
) -> String {
    if let Some(url) = url {
        if let Some(name) = map_domain_to_source(url) {
            return name;
        }
    }

    if let Some(title) = window_title.filter(|t| !t.is_empty()) {
        if let Some(name) = map_title_to_source(title) {
            return name;
        }
        return title.to_string();
    }

    normalize_app_name(source_app)
}

fn map_domain_to_source(url: &str) -> Option<String> {
    let host = extract_host(url)?.to_lowercase();

    if host.contains("chatgpt.com") || host.contains("chat.openai.com") {
        return Some("ChatGPT".to_string());
    }
    if host.contains("claude.ai") {
        return Some("Claude".to_string());
    }
    if host.contains("perplexity.ai") {
        return Some("Perplexity".to_string());
    }
    if host.contains("github.com") {
        return Some("GitHub".to_string());
    }

    None
}

fn map_title_to_source(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if lower.contains("chatgpt") {
        return Some("ChatGPT".to_string());
    }
    if lower.contains("claude") {
        return Some("Claude".to_string());
    }
    if lower.contains("perplexity") {
        return Some("Perplexity".to_string());
    }
    if lower.contains("github") {
        return Some("GitHub".to_string());
    }
    None
}

fn extract_host(url: &str) -> Option<String> {
    let trimmed = url.trim();
    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    without_scheme.split('/').next().map(|h| h.to_string())
}

fn sanitize_window_title(title: &str, app_name: &str) -> String {
    let mut cleaned = title.trim().to_string();

    for suffix in [
        " - Google Chrome",
        " — Google Chrome",
        " - Chrome",
        " - Safari",
        " - Arc",
        " - Microsoft Edge",
        " - Cursor",
        " - Visual Studio Code",
        " - Code",
    ] {
        if let Some(stripped) = cleaned.strip_suffix(suffix) {
            cleaned = stripped.trim().to_string();
            break;
        }
    }

    if cleaned.eq_ignore_ascii_case(app_name)
        || cleaned.eq_ignore_ascii_case(&normalize_app_name(app_name))
    {
        return String::new();
    }

    cleaned
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_domains() {
        assert_eq!(
            map_domain_to_source("https://chatgpt.com/c/abc"),
            Some("ChatGPT".to_string())
        );
        assert_eq!(
            map_domain_to_source("https://claude.ai/chat/123"),
            Some("Claude".to_string())
        );
        assert_eq!(
            map_domain_to_source("https://github.com/user/repo"),
            Some("GitHub".to_string())
        );
    }

    #[test]
    fn resolves_cursor_without_url() {
        assert_eq!(
            resolve_source_name("Cursor", None, None),
            "Cursor".to_string()
        );
    }
}
