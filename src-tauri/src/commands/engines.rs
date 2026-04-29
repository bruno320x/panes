use std::{
    fs,
    path::PathBuf,
    time::Instant,
};

use anyhow::{Context, Result};
use serde_json::{json, Value};
use tauri::State;
use tokio::process::Command;

#[cfg(not(target_os = "windows"))]
use crate::runtime_env;
use crate::{
    models::{
        CodexAppDto, CodexSkillDto, EngineCheckResultDto, EngineHealthDto, EngineInfoDto,
        OpenCodeRuntimeCatalogDto,
    },
    process_utils,
    state::AppState,
};

#[tauri::command]
pub async fn list_engines(state: State<'_, AppState>) -> Result<Vec<EngineInfoDto>, String> {
    state.engines.list_engines().await.map_err(err_to_string)
}

#[tauri::command]
pub async fn engine_health(
    state: State<'_, AppState>,
    engine_id: String,
) -> Result<EngineHealthDto, String> {
    state
        .engines
        .health(&engine_id)
        .await
        .map_err(err_to_string)
}

#[tauri::command]
pub async fn prewarm_engine(state: State<'_, AppState>, engine_id: String) -> Result<(), String> {
    state
        .engines
        .prewarm(&engine_id)
        .await
        .map_err(err_to_string)
}

#[tauri::command]
pub async fn list_codex_skills(
    state: State<'_, AppState>,
    cwd: String,
) -> Result<Vec<CodexSkillDto>, String> {
    state
        .engines
        .list_codex_skills(cwd.trim())
        .await
        .map_err(err_to_string)
}

#[tauri::command]
pub async fn list_codex_apps(state: State<'_, AppState>) -> Result<Vec<CodexAppDto>, String> {
    state.engines.list_codex_apps().await.map_err(err_to_string)
}

#[tauri::command]
pub async fn get_opencode_runtime_catalog(
    state: State<'_, AppState>,
    cwd: String,
) -> Result<OpenCodeRuntimeCatalogDto, String> {
    let cwd = cwd.trim();
    if cwd.is_empty() {
        return Err("cwd is required".to_string());
    }
    state
        .engines
        .opencode_runtime_catalog(cwd)
        .await
        .map_err(err_to_string)
}

#[tauri::command]
pub async fn run_engine_check(
    state: State<'_, AppState>,
    engine_id: String,
    command: String,
) -> Result<EngineCheckResultDto, String> {
    let health = state
        .engines
        .health(&engine_id)
        .await
        .map_err(err_to_string)?;
    let is_allowed = health
        .checks
        .iter()
        .chain(health.fixes.iter())
        .any(|value| value == &command);

    if !is_allowed {
        return Err("command is not allowed for this engine check".to_string());
    }

    execute_engine_check_command(&command)
        .await
        .map_err(err_to_string)
}

async fn execute_engine_check_command(command: &str) -> anyhow::Result<EngineCheckResultDto> {
    let started = Instant::now();

    let output = build_shell_command(command)
        .output()
        .await
        .with_context(|| format!("failed to execute check command: `{command}`"))?;

    let duration_ms = started.elapsed().as_millis();

    Ok(EngineCheckResultDto {
        command: command.to_string(),
        success: output.status.success(),
        exit_code: output.status.code(),
        stdout: truncate_output(&String::from_utf8_lossy(&output.stdout), 12_000),
        stderr: truncate_output(&String::from_utf8_lossy(&output.stderr), 12_000),
        duration_ms,
    })
}

#[cfg(target_os = "windows")]
fn build_shell_command(command: &str) -> Command {
    let mut cmd = Command::new("cmd");
    process_utils::configure_tokio_command(&mut cmd);
    cmd.arg("/C").arg(command);
    cmd
}

#[cfg(not(target_os = "windows"))]
fn build_shell_command(command: &str) -> Command {
    let spec = runtime_env::command_shell_for_string(command);
    let mut cmd = Command::new(&spec.program);
    process_utils::configure_tokio_command(&mut cmd);
    cmd.args(&spec.args);
    if let Some(augmented_path) = runtime_env::augmented_path_with_prepend(
        spec.program
            .parent()
            .into_iter()
            .map(|value| value.to_path_buf()),
    ) {
        cmd.env("PATH", augmented_path);
    }
    cmd
}

fn truncate_output(value: &str, max_chars: usize) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= max_chars {
        return value.to_string();
    }

    let mut out = chars.into_iter().take(max_chars).collect::<String>();
    out.push_str("\n...[truncated]");
    out
}

fn err_to_string(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[tauri::command]
pub async fn opencode_provider_login(provider: Option<String>) -> Result<String, String> {
    let mut command = Command::new("opencode");
    process_utils::configure_tokio_command(&mut command);
    command.arg("auth").arg("login");
    if let Some(p) = provider {
        command.arg(p);
    }
    command.stdin(std::process::Stdio::null());

    let output = command
        .output()
        .await
        .map_err(|e| format!("failed to execute opencode auth login: {}", e))?;

    if output.status.success() {
        Ok("Provider connected successfully".to_string())
    } else {
        Err(format!(
            "failed to connect provider: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[tauri::command]
pub async fn opencode_save_api_key_credential(
    provider_id: String,
    api_key: String,
) -> Result<String, String> {
    let provider_id = provider_id.trim().to_string();
    let api_key = api_key.trim().to_string();
    tokio::task::spawn_blocking(move || save_opencode_api_key_credential(&provider_id, &api_key))
        .await
        .map_err(|error| error.to_string())?
        .map_err(err_to_string)?;
    Ok("Provider credential saved".to_string())
}

fn save_opencode_api_key_credential(provider_id: &str, api_key: &str) -> Result<()> {
    if provider_id.is_empty() {
        anyhow::bail!("provider id is required");
    }
    if api_key.is_empty() {
        anyhow::bail!("API key is required");
    }

    let auth_path = opencode_auth_path()?;
    if let Some(parent) = auth_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create OpenCode data directory: {}", parent.display()))?;
    }

    let mut auth = if auth_path.exists() {
        let raw = fs::read_to_string(&auth_path)
            .with_context(|| format!("failed to read OpenCode auth file: {}", auth_path.display()))?;
        serde_json::from_str::<Value>(&raw).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };

    if !auth.is_object() {
        auth = json!({});
    }
    let Some(object) = auth.as_object_mut() else {
        anyhow::bail!("OpenCode auth file root is not an object");
    };
    object.insert(provider_id.to_string(), json!({ "type": "api", "key": api_key }));

    fs::write(&auth_path, format!("{}\n", serde_json::to_string_pretty(&auth)?))
        .with_context(|| format!("failed to write OpenCode auth file: {}", auth_path.display()))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&auth_path, fs::Permissions::from_mode(0o600))
            .with_context(|| format!("failed to secure OpenCode auth file: {}", auth_path.display()))?;
    }

    Ok(())
}

fn opencode_auth_path() -> Result<PathBuf> {
    let data_dir = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| home_dir().map(|home| home.join(".local").join("share")))
        .context("failed to resolve home directory for OpenCode auth storage")?;
    Ok(data_dir.join("opencode").join("auth.json"))
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}
