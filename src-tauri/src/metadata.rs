use crate::source::CaptureMetadata;
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct ClipRecord {
    pub id: String,
    pub project: String,
    pub file: String,
    pub source_app: String,
    pub source_name: String,
    pub window_title: Option<String>,
    pub url: Option<String>,
    pub timestamp: String,
    pub text: String,
}

impl ClipRecord {
    pub fn new(
        project: &str,
        file: &str,
        text: &str,
        metadata: &CaptureMetadata,
    ) -> Self {
        let source_name = if metadata.source_name.trim().is_empty() {
            "Clipboard".to_string()
        } else {
            metadata.source_name.trim().to_string()
        };

        Self {
            id: generate_clip_id(),
            project: project.to_string(),
            file: file.to_string(),
            source_app: metadata.source_app.trim().to_string(),
            source_name,
            window_title: metadata
                .window_title
                .as_ref()
                .map(|t| t.trim().to_string())
                .filter(|t| !t.is_empty()),
            url: metadata
                .url
                .as_ref()
                .map(|u| u.trim().to_string())
                .filter(|u| !u.is_empty()),
            timestamp: Local::now().to_rfc3339(),
            text: text.to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct MetadataIndex {
    version: u32,
    updated_at: String,
    projects: HashMap<String, ProjectIndexEntry>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct ProjectIndexEntry {
    updated_at: String,
    files: HashMap<String, FileIndexEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FileIndexEntry {
    jsonl: String,
    updated_at: String,
    last_clip_id: String,
}

pub fn jsonl_path_for_markdown(base: &Path, project: &str, md_file: &str) -> PathBuf {
    let stem = md_file.strip_suffix(".md").unwrap_or(md_file);
    base.join(".archivd").join(project).join(format!("{stem}.jsonl"))
}

pub fn jsonl_relative_path(project: &str, md_file: &str) -> String {
    let stem = md_file.strip_suffix(".md").unwrap_or(md_file);
    format!("{project}/{stem}.jsonl")
}

pub fn append_clip_record(
    base: &Path,
    project: &str,
    md_file: &str,
    record: &ClipRecord,
) -> Result<(), String> {
    let jsonl_path = jsonl_path_for_markdown(base, project, md_file);
    if let Some(parent) = jsonl_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let line = serde_json::to_string(record).map_err(|e| e.to_string())?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&jsonl_path)
        .map_err(|e| format!("Failed to open metadata file {}: {e}", jsonl_path.display()))?;

    file.write_all(line.as_bytes())
        .map_err(|e| e.to_string())?;
    file.write_all(b"\n").map_err(|e| e.to_string())?;

    update_index(base, project, md_file, record)?;

    Ok(())
}

fn update_index(base: &Path, project: &str, md_file: &str, record: &ClipRecord) -> Result<(), String> {
    let index_path = base.join(".archivd").join("index.json");
    fs::create_dir_all(base.join(".archivd")).map_err(|e| e.to_string())?;

    let mut index = load_index(&index_path);
    let now = Local::now().to_rfc3339();

    index.version = 1;
    index.updated_at = now.clone();

    let project_entry = index.projects.entry(project.to_string()).or_default();
    project_entry.updated_at = now.clone();

    project_entry.files.insert(
        md_file.to_string(),
        FileIndexEntry {
            jsonl: jsonl_relative_path(project, md_file),
            updated_at: now,
            last_clip_id: record.id.clone(),
        },
    );

    let data = serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?;
    fs::write(&index_path, data).map_err(|e| e.to_string())
}

fn load_index(path: &Path) -> MetadataIndex {
    if !path.exists() {
        return MetadataIndex {
            version: 1,
            updated_at: String::new(),
            projects: HashMap::new(),
        };
    }

    fs::read_to_string(path)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default()
}

fn generate_clip_id() -> String {
    format!("clip_{}", Uuid::new_v4().simple())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::CaptureMetadata;

    #[test]
    fn jsonl_path_under_root_archivd() {
        let base = Path::new("/tmp/Archivd");
        assert_eq!(
            jsonl_path_for_markdown(base, "playgrnd", "decisions.md"),
            base.join(".archivd/playgrnd/decisions.jsonl")
        );
    }

    #[test]
    fn jsonl_relative_path_format() {
        assert_eq!(
            jsonl_relative_path("playgrnd", "decisions.md"),
            "playgrnd/decisions.jsonl"
        );
    }

    #[test]
    fn serializes_clip_record_as_valid_json() {
        let record = ClipRecord::new(
            "playgrnd",
            "decisions.md",
            "hello\nworld",
            &CaptureMetadata {
                source_app: "Google Chrome".to_string(),
                source_name: "Claude".to_string(),
                url: Some("https://claude.ai/chat".to_string()),
                window_title: Some("Claude - Architecture".to_string()),
            },
        );

        let json = serde_json::to_string(&record).unwrap();
        assert!(json.contains("\"project\":\"playgrnd\""));
        assert!(json.contains("\"text\":\"hello\\nworld\""));
        assert!(json.starts_with('{'));
    }
}
