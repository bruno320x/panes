use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

// ============================================================
// Tipos
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub provider: String,
    pub category: String,
    pub path: String,
    pub is_native: bool,
    pub enabled: bool,
    pub license: Option<String>,
    pub compatibility: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub provider: String,
    pub category: String,
    pub skills: Vec<SkillInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsPreferences {
    pub disabled_skills: Vec<String>,
    pub last_tab: Option<String>,
}

// ============================================================
// Paths de Skills por Provider
// ============================================================

fn get_skills_paths(provider: &str) -> Vec<PathBuf> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    match provider {
        "opencode" => vec![
            cwd.join(".opencode/skills"),
            home.join(".config/opencode/skills"),
        ],
        "codex" => vec![
            cwd.join(".codex/skills"),
            cwd.join(".claude/skills"),
        ],
        "claude" => vec![
            cwd.join(".claude/skills"),
            home.join(".claude/skills"),
        ],
        "custom" => vec![
            cwd.join(".skills"),
            cwd.join(".agents/skills"),
        ],
        _ => vec![],
    }
}

// ============================================================
// Parse Frontmatter
// ============================================================

fn parse_frontmatter(content: &str) -> Option<(serde_json::Value, String)> {
    if !content.starts_with("---") {
        return None;
    }

    let end_idx = content[3..].find("---")?;
    let yaml_str = &content[3..end_idx + 3];
    let body = content[end_idx + 6..].trim().to_string();

    let mut frontmatter = serde_json::Map::new();

    for line in yaml_str.lines() {
        if let Some(colon_idx) = line.find(':') {
            let key = line[..colon_idx].trim().to_string();
            let value: serde_json::Value = line[colon_idx + 1..].trim().parse().unwrap_or(serde_json::Value::String(line[colon_idx + 1..].trim().to_string()));
            frontmatter.insert(key, value);
        }
    }

    Some((serde_json::Value::Object(frontmatter), body))
}

fn parse_yaml_bool(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Bool(b) => *b,
        serde_json::Value::String(s) => s == "true" || s == "TRUE",
        _ => false,
    }
}

// ============================================================
// Scan Functions
// ============================================================

fn scan_directory(dir: &PathBuf) -> std::io::Result<Vec<SkillInfo>> {
    let mut skills = Vec::new();

    if !dir.exists() {
        return Ok(skills);
    }

    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let folder_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Validar nome da skill (formato opencode)
        if !is_valid_skill_name(folder_name) {
            continue;
        }

        // Ler e parsear SKILL.md
        if let Ok(content) = std::fs::read_to_string(&skill_md) {
            if let Some((fm, _body)) = parse_frontmatter(&content) {
                let name = fm
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or(folder_name)
                    .to_string();

                let description = fm
                    .get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let license = fm.get("license").and_then(|v| v.as_str()).map(String::from);

                let compatibility = fm
                    .get("compatibility")
                    .and_then(|v| v.as_str())
                    .map(String::from);

                let id = format!(
                    "{}:{}",
                    dir.parent()
                        .unwrap_or(dir)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("custom"),
                    folder_name
                );

                skills.push(SkillInfo {
                    id,
                    name,
                    description,
                    provider: dir
                        .parent()
                        .unwrap_or(dir)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("custom")
                        .to_string(),
                    category: dir
                        .parent()
                        .unwrap_or(dir)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("custom")
                        .to_string(),
                    path: skill_md.to_string_lossy().to_string(),
                    is_native: true,
                    enabled: true, // Será atualizado pelas preferências
                    license,
                    compatibility,
                });
            }
        }
    }

    Ok(skills)
}

fn is_valid_skill_name(name: &str) -> bool {
    // Regex: ^[a-z0-9]+(-[a-z0-9]+)*$
    let mut chars = name.chars();
    match chars.next() {
        Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit() => {}
        _ => return false,
    }

    let mut prev_hyphen = false;
    for c in chars {
        match c {
            c if c.is_ascii_lowercase() || c.is_ascii_digit() => {
                prev_hyphen = false;
            }
            '-' if !prev_hyphen => {
                prev_hyphen = true;
            }
            _ => return false,
        }
    }

    !prev_hyphen && name.len() <= 64
}

// ============================================================
// Tauri Commands
// ============================================================

#[tauri::command]
pub async fn scan_skills(provider: String) -> Result<ScanResult, String> {
    let paths = get_skills_paths(&provider);
    let mut all_skills = Vec::new();
    let mut last_error = None;

    for dir in paths {
        match scan_directory(&dir) {
            Ok(skills) => all_skills.extend(skills),
            Err(e) => {
                last_error = Some(e.to_string());
            }
        }
    }

    Ok(ScanResult {
        provider: provider.clone(),
        category: provider,
        skills: all_skills,
        error: last_error,
    })
}

#[tauri::command]
pub async fn scan_all_skills() -> Result<Vec<ScanResult>, String> {
    let providers = vec!["opencode", "codex", "claude", "custom"];
    let mut results = Vec::new();

    for provider in providers {
        match scan_skills(provider.to_string()).await {
            Ok(result) => results.push(result),
            Err(e) => results.push(ScanResult {
                provider: provider.to_string(),
                category: provider.to_string(),
                skills: vec![],
                error: Some(e),
            }),
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_skill_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
