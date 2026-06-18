use crate::metadata::ClipRecord;
use crate::settings::base_dir;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Clip {
    pub id: String,
    pub project: String,
    pub file: String,
    pub source_app: String,
    pub source_name: String,
    pub window_title: Option<String>,
    pub url: Option<String>,
    pub timestamp: String,
    pub text: String,
    pub markdown_path: String,
    pub markdown_exists: bool,
    pub starred: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ArchiveState {
    pub starred: HashSet<String>,
}

impl ArchiveState {
    fn path(base: &Path) -> PathBuf {
        base.join(".archivd").join("state.json")
    }

    pub fn load(base: &Path) -> Self {
        let path = Self::path(base);
        if !path.exists() {
            return Self::default();
        }
        fs::read_to_string(&path)
            .ok()
            .and_then(|data| serde_json::from_str(&data).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, base: &Path) -> Result<(), String> {
        let path = Self::path(base);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let data = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, data).map_err(|e| e.to_string())
    }
}

pub fn load_all_clips() -> Result<Vec<Clip>, String> {
    let base = base_dir();
    let metadata_root = base.join(".archivd");
    let state = ArchiveState::load(&base);

    let mut clips = Vec::new();
    if metadata_root.exists() {
        collect_jsonl_clips(&metadata_root, &base, &state, &mut clips)?;
    }

    clips.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(clips)
}

fn collect_jsonl_clips(
    dir: &Path,
    base: &Path,
    state: &ArchiveState,
    clips: &mut Vec<Clip>,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            collect_jsonl_clips(&path, base, state, clips)?;
            continue;
        }

        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }

        read_jsonl_file(&path, base, state, clips);
    }
    Ok(())
}

fn read_jsonl_file(path: &Path, base: &Path, state: &ArchiveState, clips: &mut Vec<Clip>) {
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(record) = serde_json::from_str::<ClipRecord>(trimmed) else {
            continue;
        };

        let id = record.id.clone();
        let markdown_path = base.join(&record.project).join(&record.file);
        let markdown_exists = markdown_path.exists();
        let starred = state.starred.contains(&id);

        clips.push(Clip {
            id,
            project: record.project,
            file: record.file,
            source_app: record.source_app,
            source_name: record.source_name,
            window_title: record.window_title,
            url: record.url,
            timestamp: record.timestamp,
            text: record.text,
            markdown_path: markdown_path.to_string_lossy().to_string(),
            markdown_exists,
            starred,
        });
    }
}

pub fn toggle_star(clip_id: &str) -> Result<bool, String> {
    let base = base_dir();
    let mut state = ArchiveState::load(&base);
    let starred = if state.starred.contains(clip_id) {
        state.starred.remove(clip_id);
        false
    } else {
        state.starred.insert(clip_id.to_string());
        true
    };
    state.save(&base)?;
    Ok(starred)
}

pub fn open_path(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Open path is only supported on macOS".into())
    }
}

pub fn reveal_in_finder(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Reveal in Finder is only supported on macOS".into())
    }
}

pub fn open_url(url: &str) -> Result<(), String> {
    open_path(url)
}
