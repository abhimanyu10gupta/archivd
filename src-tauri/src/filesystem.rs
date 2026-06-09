use crate::settings::{base_dir, expand_path};
use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

pub fn ensure_base_dir() -> Result<(), String> {
    let dir = base_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())
}

pub fn list_projects() -> Result<Vec<String>, String> {
    let dir = base_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        return Ok(vec![]);
    }

    let mut projects: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| {
            entry
                .file_name()
                .to_str()
                .map(|s| s.to_string())
                .filter(|s| !s.starts_with('.'))
        })
        .collect();

    projects.sort();
    Ok(projects)
}

pub fn list_markdown_files(project: &str) -> Result<Vec<String>, String> {
    let project_dir = base_dir().join(project);
    if !project_dir.exists() {
        return Ok(vec![]);
    }

    let mut files: Vec<String> = fs::read_dir(&project_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .map(|ext| ext == "md")
                .unwrap_or(false)
        })
        .filter_map(|entry| {
            entry
                .file_name()
                .to_str()
                .map(|s| s.to_string())
        })
        .collect();

    files.sort();
    Ok(files)
}

fn validate_name(name: &str, kind: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(format!("{kind} name cannot be empty"));
    }
    if trimmed.contains(['/', '\\']) || trimmed.contains("..") {
        return Err(format!("Invalid {kind} name"));
    }
    Ok(trimmed.to_string())
}

fn normalize_filename(file: &str) -> String {
    let trimmed = file.trim();
    if trimmed.ends_with(".md") {
        trimmed.to_string()
    } else {
        format!("{trimmed}.md")
    }
}

pub fn save_entry(project: &str, file: &str, text: &str) -> Result<(), String> {
    let project = validate_name(project, "Project")?;
    let file = normalize_filename(&validate_name(file, "File")?);

    let project_dir = base_dir().join(&project);
    fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;

    let file_path = project_dir.join(&file);
    if !file_path.exists() {
        fs::write(&file_path, format!("# {file}\n")).map_err(|e| e.to_string())?;
    }

    let entry = format_entry(text);

    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| e.to_string())?;

    f.write_all(entry.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn format_entry(text: &str) -> String {
    let now = Local::now().format("%Y-%m-%d %I:%M %p").to_string();
    let lines: Vec<&str> = text.lines().collect();
    let body = if lines.is_empty() {
        "> \n".to_string()
    } else {
        lines
            .iter()
            .map(|line| format!("> {line}"))
            .collect::<Vec<_>>()
            .join("\n")
            + "\n"
    };

    format!("\n## {now}\n\nSource: Clipboard\n\n{body}\n")
}

pub fn create_sample_structure() -> Result<(), String> {
    let base = base_dir();
    let samples: Vec<(&str, &str)> = vec![
        ("playgrnd", "ideas.md"),
        ("playgrnd", "debugging.md"),
        ("playgrnd", "decisions.md"),
        ("jrnld", "prompts.md"),
        ("jrnld", "architecture.md"),
        ("spendsmart", "bugs.md"),
    ];

    for (project, file) in samples {
        let dir = base.join(project);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(file);
        if !path.exists() {
            fs::write(&path, format!("# {file}\n")).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[allow(dead_code)]
pub fn resolve_path(project: &str, file: &str) -> PathBuf {
    base_dir().join(project).join(file)
}

#[allow(dead_code)]
pub fn resolve_base(path: &str) -> PathBuf {
    expand_path(path)
}
