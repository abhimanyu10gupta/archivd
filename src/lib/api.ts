import { invoke } from "@tauri-apps/api/core";
import type { Clip } from "./types";

export interface AppSettings {
  base_dir: string;
}

export interface CaptureMetadata {
  source_app: string;
  source_name: string;
  url?: string | null;
  window_title?: string | null;
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
  metadata: CaptureMetadata,
): Promise<void> {
  return invoke("save_entry", { project, file, text, metadata });
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

export async function hideWindow(label: "popup" | "dashboard"): Promise<void> {
  return invoke("hide_window", { label });
}

export async function loadClips(): Promise<Clip[]> {
  return invoke<Clip[]>("load_clips");
}

export async function toggleStar(clipId: string): Promise<boolean> {
  return invoke<boolean>("toggle_star", { clipId });
}

export async function openPath(path: string): Promise<void> {
  return invoke("open_path", { path });
}

export async function openUrl(url: string): Promise<void> {
  return invoke("open_url", { url });
}

export async function revealInFinder(path: string): Promise<void> {
  return invoke("reveal_in_finder", { path });
}

export async function openBaseDir(): Promise<void> {
  return invoke("open_base_dir");
}
