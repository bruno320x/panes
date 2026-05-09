import type { Repo } from "../types";

const LAST_REPO_BY_WORKSPACE_KEY = "panes:lastActiveRepoByWorkspace";

type LastRepoByWorkspace = Record<string, string>;

function readLastRepoByWorkspace(): LastRepoByWorkspace {
  try {
    const raw = localStorage.getItem(LAST_REPO_BY_WORKSPACE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const next: LastRepoByWorkspace = {};
    for (const [workspaceId, repoId] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof workspaceId !== "string" || typeof repoId !== "string") {
        continue;
      }
      const normalizedRepoId = repoId.trim();
      if (!normalizedRepoId) {
        continue;
      }
      next[workspaceId] = normalizedRepoId;
    }
    return next;
  } catch {
    return {};
  }
}

function writeLastRepoByWorkspace(next: LastRepoByWorkspace): void {
  try {
    localStorage.setItem(LAST_REPO_BY_WORKSPACE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable or full; ignore persistence failure.
  }
}

export function rememberLastRepo(workspaceId: string, repoId: string): void {
  const current = readLastRepoByWorkspace();
  if (current[workspaceId] === repoId) {
    return;
  }
  current[workspaceId] = repoId;
  writeLastRepoByWorkspace(current);
}

export function resolveActiveRepoId(
  workspaceId: string,
  repos: Repo[],
  currentActiveRepoId: string | null,
): string | null {
  if (!repos.length) {
    return null;
  }

  if (currentActiveRepoId && repos.some((repo) => repo.id === currentActiveRepoId)) {
    return currentActiveRepoId;
  }

  const persisted = readLastRepoByWorkspace()[workspaceId];
  if (persisted && repos.some((repo) => repo.id === persisted && repo.isActive)) {
    return persisted;
  }

  return repos.find((repo) => repo.isActive)?.id ?? repos[0]?.id ?? null;
}
