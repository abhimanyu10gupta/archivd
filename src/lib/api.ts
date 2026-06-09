import { invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  base_dir: string;
}

export async function captureClipboard(): Promise<string> {
  return invoke<string>("capture_clipboard");
}

export async function listProjects(): Promise<string[]> {
  return invoke<string[]>("list_projects");
}

export async function listMarkdownFiles(project: string): Promise<string[]> {
  return invoke<string[]>("list_markdown_files", { project });
}

export async function saveEntry(
  project: string,
  file: string,
  text: string,
): Promise<void> {
  return invoke("save_entry", { project, file, text });
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function ensureBaseDir(): Promise<void> {
  return invoke("ensure_base_dir");
}

export async function hideWindow(label: "popup" | "settings"): Promise<void> {
  return invoke("hide_window", { label });
}
