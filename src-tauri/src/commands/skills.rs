use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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

// ============================================================
// Paths de Skills por Provider
// ============================================================

fn resolve_workspace_root(cwd: Option<&str>) -> PathBuf {
    cwd.map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn get_skills_paths(provider: &str, cwd: Option<&str>) -> Vec<PathBuf> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    let workspace_root = resolve_workspace_root(cwd);

    match provider {
        "opencode" => vec![
            workspace_root.join(".opencode/skills"),
            home.join(".config/opencode/skills"),
        ],
        "codex" => vec![
            workspace_root.join(".codex/skills"),
            workspace_root.join(".claude/skills"),
        ],
        "claude" => vec![
            workspace_root.join(".claude/skills"),
            home.join(".claude/skills"),
        ],
        "custom" => vec![
            workspace_root.join(".skills"),
            workspace_root.join(".agents/skills"),
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
            let value: serde_json::Value =
                line[colon_idx + 1..]
                    .trim()
                    .parse()
                    .unwrap_or(serde_json::Value::String(
                        line[colon_idx + 1..].trim().to_string(),
                    ));
            frontmatter.insert(key, value);
        }
    }

    Some((serde_json::Value::Object(frontmatter), body))
}

// ============================================================
// Scan Functions
// ============================================================

fn scan_directory(dir: &PathBuf, provider: &str) -> std::io::Result<Vec<SkillInfo>> {
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

                let id = format!("{provider}:{folder_name}");

                skills.push(SkillInfo {
                    id,
                    name,
                    description,
                    provider: provider.to_string(),
                    category: provider.to_string(),
                    path: skill_md.to_string_lossy().to_string(),
                    is_native: provider != "custom",
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
pub async fn scan_skills(provider: String, cwd: Option<String>) -> Result<ScanResult, String> {
    let paths = get_skills_paths(&provider, cwd.as_deref());
    let mut all_skills = Vec::new();
    let mut last_error = None;

    for dir in paths {
        match scan_directory(&dir, &provider) {
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
pub async fn scan_all_skills(cwd: Option<String>) -> Result<Vec<ScanResult>, String> {
    let providers = vec!["opencode", "codex", "claude", "custom"];
    let mut results = Vec::new();

    for provider in providers {
        match scan_skills(provider.to_string(), cwd.clone()).await {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_skill_dir() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("panes-skills-test-{suffix}"))
    }

    #[test]
    fn scan_directory_preserves_requested_provider_metadata() {
        let root = temp_skill_dir();
        let skill_dir = root.join("my-skill");
        fs::create_dir_all(&skill_dir).expect("test skill directory should be created");
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: My Skill\ndescription: Test skill\nlicense: MIT\n---\nBody",
        )
        .expect("test skill should be written");

        let skills = scan_directory(&root, "custom").expect("skill directory should scan");

        fs::remove_dir_all(&root).ok();

        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].id, "custom:my-skill");
        assert_eq!(skills[0].provider, "custom");
        assert_eq!(skills[0].category, "custom");
        assert!(!skills[0].is_native);
        assert_eq!(skills[0].license.as_deref(), Some("MIT"));
    }

    #[test]
    fn get_skills_paths_uses_workspace_root_for_project_paths() {
        let paths = get_skills_paths("codex", Some("/workspace/project"));

        assert_eq!(paths[0], PathBuf::from("/workspace/project/.codex/skills"));
        assert_eq!(paths[1], PathBuf::from("/workspace/project/.claude/skills"));
    }
}
