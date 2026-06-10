use crate::source::CaptureMetadata;
use chrono::Local;
use serde::Serialize;
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

pub fn append_clip_record(project_dir: &Path, md_file: &str, record: &ClipRecord) -> Result<(), String> {
    let jsonl_path = jsonl_path_for_markdown(project_dir, md_file);
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

    Ok(())
}

pub fn jsonl_path_for_markdown(project_dir: &Path, md_file: &str) -> PathBuf {
    let stem = md_file.strip_suffix(".md").unwrap_or(md_file);
    project_dir.join(".archivd").join(format!("{stem}.jsonl"))
}

fn generate_clip_id() -> String {
    format!("clip_{}", Uuid::new_v4().simple())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::CaptureMetadata;

    #[test]
    fn jsonl_path_mirrors_markdown_file() {
        let dir = Path::new("/tmp/playgrnd");
        assert_eq!(
            jsonl_path_for_markdown(dir, "decisions.md"),
            dir.join(".archivd/decisions.jsonl")
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
