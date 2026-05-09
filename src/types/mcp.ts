/**
 * MCP (Model Context Protocol) types
 */

/**
 * MCP client connection state
 */
export type MCPClientStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP client configuration
 */
export interface MCPClient {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: MCPClientStatus;
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
}

/**
 * MCP resource definition
 */
export interface MCPResource {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * MCP server info (from backend)
 */
export interface MCPInfo {
  id: string;
  name: string;
  status: MCPClientStatus;
  tools?: MCPTool[];
  resources?: MCPResource[];
  error?: string;
}

/**
 * MCP configuration for workspace
 */
export interface MCPConfig {
  servers: Omit<MCPClient, 'id' | 'status'>[];
}

/**
 * MCP runtime event
 */
export interface MCPRuntimeEvent {
  serverId: string;
  type: 'status_changed' | 'tools_updated' | 'error';
  data?: {
    status?: MCPClientStatus;
    tools?: MCPTool[];
    error?: string;
  };
}
