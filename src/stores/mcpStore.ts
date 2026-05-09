/**
 * MCP Store - Zustand store for MCP state management
 */

import { create } from 'zustand';
import { ipc } from '../lib/ipc';
import type { MCPClient, MCPClientStatus, MCPInfo, MCPTool } from '../types/mcp';

interface MCPState {
  clients: MCPClient[];
  tools: Record<string, MCPTool[]>;
  loading: boolean;
  error?: string;

  // Actions
  loadServers: () => Promise<void>;
  addClient: (client: Omit<MCPClient, 'id' | 'status'>) => Promise<string>;
  removeClient: (id: string) => Promise<void>;
  updateStatus: (id: string, status: MCPClientStatus) => void;
  startServer: (id: string) => Promise<void>;
  stopServer: (id: string) => Promise<void>;
}

export const useMCPStore = create<MCPState>((set, get) => ({
  clients: [],
  tools: {},
  loading: false,

  loadServers: async () => {
    set({ loading: true, error: undefined });
    try {
      const servers: MCPInfo[] = await ipc.mcpListServers();
      const clients: MCPClient[] = servers.map((s) => ({
        id: s.id,
        name: s.name,
        command: '',
        args: [],
        env: {},
        status: s.status,
      }));
      const tools: Record<string, MCPTool[]> = {};
      for (const server of servers) {
        if (server.tools) {
          tools[server.id] = server.tools;
        }
      }
      set({ clients, tools, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: String(error),
      });
    }
  },

  addClient: async (client) => {
    const id = crypto.randomUUID();
    const newClient: MCPClient = {
      ...client,
      id,
      status: 'disconnected',
    };
    set((state) => ({
      clients: [...state.clients, newClient],
    }));
    return id;
  },

  removeClient: async (id) => {
    set((state) => ({
      clients: state.clients.filter((c) => c.id !== id),
      tools: Object.fromEntries(
        Object.entries(state.tools).filter(([key]) => key !== id)
      ),
    }));
  },

  updateStatus: (id, status) => {
    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
    }));
  },

  startServer: async (id) => {
    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === id ? { ...c, status: 'connecting' } : c
      ),
    }));
    try {
      await ipc.mcpStartServer(id);
      set((state) => ({
        clients: state.clients.map((c) =>
          c.id === id ? { ...c, status: 'connected' } : c
        ),
      }));
    } catch (error) {
      set((state) => ({
        clients: state.clients.map((c) =>
          c.id === id ? { ...c, status: 'error' } : c
        ),
        error: String(error),
      }));
    }
  },

  stopServer: async (id) => {
    try {
      await ipc.mcpStopServer(id);
      set((state) => ({
        clients: state.clients.map((c) =>
          c.id === id ? { ...c, status: 'disconnected' } : c
        ),
      }));
    } catch (error) {
      set((state) => ({
        clients: state.clients.map((c) =>
          c.id === id ? { ...c, status: 'error' } : c
        ),
        error: String(error),
      }));
    }
  },
}));
