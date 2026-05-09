/**
 * MCP Commands - Tauri commands for MCP server management
 */
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::state::AppState;

const STANDALONE_MCP_UNAVAILABLE: &str = "Standalone MCP server management is not implemented yet. Use Codex/OpenCode runtime diagnostics for MCP status.";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MCPInfo {
    pub id: String,
    pub name: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MCPTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MCPResource {
    pub uri: String,
    pub name: String,
    pub mime_type: String,
}

fn standalone_mcp_unavailable<T>() -> Result<T, String> {
    Err(STANDALONE_MCP_UNAVAILABLE.to_string())
}

#[tauri::command]
pub async fn mcp_list_servers(_state: State<'_, AppState>) -> Result<Vec<MCPInfo>, String> {
    log::info!("mcp_list_servers called");
    Ok(vec![])
}

#[tauri::command]
pub async fn mcp_start_server(_state: State<'_, AppState>, id: String) -> Result<(), String> {
    log::warn!(
        "mcp_start_server called without runtime implementation: {}",
        id
    );
    standalone_mcp_unavailable()
}

#[tauri::command]
pub async fn mcp_stop_server(_state: State<'_, AppState>, id: String) -> Result<(), String> {
    log::warn!(
        "mcp_stop_server called without runtime implementation: {}",
        id
    );
    standalone_mcp_unavailable()
}

#[tauri::command]
pub async fn mcp_list_tools(
    _state: State<'_, AppState>,
    server_id: String,
) -> Result<Vec<MCPTool>, String> {
    log::warn!(
        "mcp_list_tools called without runtime implementation: {}",
        server_id
    );
    standalone_mcp_unavailable()
}

#[tauri::command]
pub async fn mcp_list_resources(
    _state: State<'_, AppState>,
    server_id: String,
) -> Result<Vec<MCPResource>, String> {
    log::warn!(
        "mcp_list_resources called without runtime implementation: {}",
        server_id
    );
    standalone_mcp_unavailable()
}

#[tauri::command]
pub async fn mcp_call_tool(
    _state: State<'_, AppState>,
    server_id: String,
    tool_name: String,
    _arguments: serde_json::Value,
) -> Result<serde_json::Value, String> {
    log::warn!(
        "mcp_call_tool called without runtime implementation for server: {}, tool: {}",
        server_id,
        tool_name
    );
    standalone_mcp_unavailable()
}

#[tauri::command]
pub async fn mcp_read_resource(
    _state: State<'_, AppState>,
    server_id: String,
    uri: String,
) -> Result<String, String> {
    log::warn!(
        "mcp_read_resource called without runtime implementation for server: {}, uri: {}",
        server_id,
        uri
    );
    standalone_mcp_unavailable()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standalone_mcp_commands_report_unavailable_runtime() {
        let err = standalone_mcp_unavailable::<()>().expect_err("command should fail honestly");

        assert!(err.contains("not implemented yet"));
        assert!(err.contains("runtime diagnostics"));
    }
}
