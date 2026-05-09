import { create } from "zustand";
import type { Repo, TrustLevel, Workspace } from "../types";
import { ipc } from "../lib/ipc";
import { rememberLastRepo, resolveActiveRepoId } from "../lib/workspaceSelection";
import { useGitStore } from "./gitStore";
import { useTerminalStore } from "./terminalStore";

interface SetActiveRepoOptions {
  remember?: boolean;
}

interface WorkspaceState {
  workspaces: Workspace[];
  archivedWorkspaces: Workspace[];
  activeWorkspaceId: string | null;
  repos: Repo[];
  activeRepoId: string | null;
  reposLoading: boolean;
  loading: boolean;
  error?: string;
  loadWorkspaces: () => Promise<void>;
  refreshArchivedWorkspaces: () => Promise<void>;
  openWorkspace: (path: string, scanDepth?: number) => Promise<Workspace | null>;
  removeWorkspace: (workspaceId: string) => Promise<void>;
  restoreWorkspace: (workspaceId: string) => Promise<void>;
  loadRepos: (workspaceId: string) => Promise<void>;
  setActiveWorkspace: (workspaceId: string) => Promise<void>;
  setActiveRepo: (repoId: string | null, options?: SetActiveRepoOptions) => void;
  setRepoGitActive: (repoId: string, isActive: boolean) => Promise<void>;
  setWorkspaceGitActiveRepos: (workspaceId: string, repoIds: string[]) => Promise<void>;
  hasWorkspaceGitSelection: (workspaceId: string) => Promise<boolean>;
  setRepoTrustLevel: (repoId: string, trustLevel: TrustLevel) => Promise<void>;
  setAllReposTrustLevel: (trustLevel: TrustLevel) => Promise<void>;
  rescanWorkspace: (workspaceId: string, scanDepth?: number) => Promise<Workspace | null>;
}

const LAST_WORKSPACE_KEY = "panes:lastActiveWorkspaceId";
let reposLoadSeq = 0;

function isTransientLinuxAppImageRoot(rootPath: string): boolean {
  return /^\/(?:var\/tmp|tmp)\/\.mount_[^/]+(?:\/|$)/.test(rootPath);
}

function resolveStartupWorkspaceId(
  workspaces: Workspace[],
  savedId: string | null,
): string | null {
  const savedWorkspace = savedId
    ? workspaces.find((workspace) => workspace.id === savedId) ?? null
    : null;

  if (savedWorkspace && !isTransientLinuxAppImageRoot(savedWorkspace.rootPath)) {
    return savedWorkspace.id;
  }

  if (!savedId) {
    return null;
  }

  return (
    workspaces.find((workspace) => !isTransientLinuxAppImageRoot(workspace.rootPath))?.id ?? null
  );
}

async function prepareTerminalWorkspaceActivation(workspaceId: string, workspaceRootPath?: string | null): Promise<void> {
  await useTerminalStore.getState().prepareWorkspaceActivation(workspaceId, workspaceRootPath);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  archivedWorkspaces: [],
  activeWorkspaceId: null,
  repos: [],
  activeRepoId: null,
  reposLoading: false,
  loading: false,
  loadWorkspaces: async () => {
    set({ loading: true, error: undefined });
    try {
      const workspaces = await ipc.listWorkspaces();
      const savedId = localStorage.getItem(LAST_WORKSPACE_KEY);
      const activeWorkspaceId = resolveStartupWorkspaceId(workspaces, savedId);
      set({ workspaces, activeWorkspaceId, loading: false });
      if (activeWorkspaceId) {
        const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
        await prepareTerminalWorkspaceActivation(activeWorkspaceId, activeWorkspace?.rootPath);
        useGitStore.getState().loadDraftsForWorkspace(activeWorkspaceId);
        await get().loadRepos(activeWorkspaceId);
      }
      await get().refreshArchivedWorkspaces();
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },
  refreshArchivedWorkspaces: async () => {
    try {
      const archivedWorkspaces = await ipc.listArchivedWorkspaces();
      set({ archivedWorkspaces });
    } catch (error) {
      set({ error: String(error) });
    }
  },
  openWorkspace: async (path, scanDepth) => {
    set({ loading: true, error: undefined });
    try {
      const workspace = await ipc.openWorkspace(path, scanDepth);
      const current = get().workspaces.filter((item) => item.id !== workspace.id);
      const workspaces = [workspace, ...current];
      set((state) => ({
        workspaces,
        archivedWorkspaces: state.archivedWorkspaces.filter((item) => item.id !== workspace.id),
        activeWorkspaceId: workspace.id,
        loading: false,
      }));
      await prepareTerminalWorkspaceActivation(workspace.id, workspace.rootPath);
      await get().loadRepos(workspace.id);
      return workspace;
    } catch (error) {
      set({ loading: false, error: String(error) });
      return null;
    }
  },
  removeWorkspace: async (workspaceId) => {
    set({ loading: true, error: undefined });
    try {
      await ipc.archiveWorkspace(workspaceId);
      const wasActiveWorkspace = get().activeWorkspaceId === workspaceId;
      const removed = get().workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
      const remaining = get().workspaces.filter((workspace) => workspace.id !== workspaceId);
      const nextActive =
        wasActiveWorkspace
          ? remaining[0]?.id ?? null
          : get().activeWorkspaceId;

      set((state) => ({
        workspaces: remaining,
        archivedWorkspaces: removed
          ? [
              removed,
              ...state.archivedWorkspaces.filter((workspace) => workspace.id !== workspaceId),
            ]
          : state.archivedWorkspaces,
        activeWorkspaceId: nextActive,
        loading: false,
      }));

      if (nextActive) {
        if (wasActiveWorkspace) {
          const nextWorkspace = remaining.find((workspace) => workspace.id === nextActive);
          await prepareTerminalWorkspaceActivation(nextActive, nextWorkspace?.rootPath);
        }
        await get().loadRepos(nextActive);
      } else {
        set({ repos: [], activeRepoId: null, reposLoading: false });
      }
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },
  restoreWorkspace: async (workspaceId) => {
    set({ loading: true, error: undefined });
    try {
      const restored = await ipc.restoreWorkspace(workspaceId);
      set((state) => {
        const workspaces = [
          restored,
          ...state.workspaces.filter((workspace) => workspace.id !== workspaceId),
        ];
        const nextActiveWorkspaceId = state.activeWorkspaceId ?? restored.id;
        return {
          workspaces,
          archivedWorkspaces: state.archivedWorkspaces.filter(
            (workspace) => workspace.id !== workspaceId,
          ),
          activeWorkspaceId: nextActiveWorkspaceId,
          loading: false,
        };
      });

      if (!get().activeWorkspaceId || get().activeWorkspaceId === restored.id) {
        await prepareTerminalWorkspaceActivation(restored.id, restored.rootPath);
        await get().loadRepos(restored.id);
      }
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },
  loadRepos: async (workspaceId) => {
    const requestSeq = ++reposLoadSeq;
    set({ reposLoading: true });
    try {
      const repos = await ipc.getRepos(workspaceId);
      if (requestSeq !== reposLoadSeq) {
        return;
      }
      if (get().activeWorkspaceId !== workspaceId) {
        set({ reposLoading: false });
        return;
      }
      const fallbackActiveRepoId = resolveActiveRepoId(
        workspaceId,
        repos,
        get().activeRepoId,
      );
      if (fallbackActiveRepoId) {
        rememberLastRepo(workspaceId, fallbackActiveRepoId);
      }
      set({
        repos,
        activeRepoId: fallbackActiveRepoId,
        reposLoading: false,
      });
    } catch (error) {
      if (requestSeq !== reposLoadSeq) {
        return;
      }
      if (get().activeWorkspaceId !== workspaceId) {
        set({ reposLoading: false });
        return;
      }
      set({ error: String(error), reposLoading: false });
    }
  },
  setActiveWorkspace: async (workspaceId) => {
    const prevWorkspaceId = get().activeWorkspaceId;
    if (prevWorkspaceId) {
      useGitStore.getState().flushDrafts(prevWorkspaceId);
    }
    localStorage.setItem(LAST_WORKSPACE_KEY, workspaceId);
    set({ activeWorkspaceId: workspaceId, activeRepoId: null, repos: [], error: undefined });
    const workspace = get().workspaces.find((item) => item.id === workspaceId);
    await prepareTerminalWorkspaceActivation(workspaceId, workspace?.rootPath);
    await get().loadRepos(workspaceId);
    useGitStore.getState().loadDraftsForWorkspace(workspaceId);
  },
  setActiveRepo: (repoId, options) => {
    set({ activeRepoId: repoId });

    if (options?.remember === false || !repoId) {
      return;
    }

    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) {
      return;
    }

    const repoExistsInWorkspace = get().repos.some(
      (repo) => repo.id === repoId && repo.workspaceId === workspaceId,
    );
    if (!repoExistsInWorkspace) {
      return;
    }

    rememberLastRepo(workspaceId, repoId);
  },
  setRepoGitActive: async (repoId, isActive) => {
    try {
      await ipc.setRepoGitActive(repoId, isActive);
      set((state) => ({
        repos: state.repos.map((repo) =>
          repo.id === repoId
            ? {
                ...repo,
                isActive,
              }
            : repo,
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  setWorkspaceGitActiveRepos: async (workspaceId, repoIds) => {
    try {
      await ipc.setWorkspaceGitActiveRepos(workspaceId, repoIds);
      set((state) => {
        const selected = new Set(repoIds);
        return {
          repos: state.repos.map((repo) =>
            repo.workspaceId === workspaceId
              ? {
                  ...repo,
                  isActive: selected.has(repo.id),
                }
              : repo,
          ),
        };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  hasWorkspaceGitSelection: async (workspaceId) => {
    const status = await ipc.hasWorkspaceGitSelection(workspaceId);
    return status.configured;
  },
  setRepoTrustLevel: async (repoId, trustLevel) => {
    try {
      await ipc.setRepoTrustLevel(repoId, trustLevel);
      set((state) => ({
        repos: state.repos.map((repo) =>
          repo.id === repoId
            ? {
                ...repo,
                trustLevel
              }
            : repo
        )
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },
  rescanWorkspace: async (workspaceId, scanDepth) => {
    const workspace = get().workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return null;

    try {
      const updatedWorkspace = await ipc.openWorkspace(
        workspace.rootPath,
        scanDepth ?? workspace.scanDepth,
      );
      set((state) => ({
        workspaces: [
          updatedWorkspace,
          ...state.workspaces.filter((item) => item.id !== updatedWorkspace.id),
        ],
        archivedWorkspaces: state.archivedWorkspaces.filter(
          (item) => item.id !== updatedWorkspace.id,
        ),
      }));

      if (get().activeWorkspaceId === workspaceId) {
        await get().loadRepos(workspaceId);
      }

      return updatedWorkspace;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  setAllReposTrustLevel: async (trustLevel) => {
    const repos = get().repos;
    if (!repos.length) {
      return;
    }

    try {
      await Promise.all(
        repos.map((repo) => ipc.setRepoTrustLevel(repo.id, trustLevel))
      );
      set((state) => ({
        repos: state.repos.map((repo) => ({
          ...repo,
          trustLevel
        }))
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  }
}));
