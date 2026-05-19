import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTerminalStore, collectSessionIds } from "../../stores/terminalStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useHarnessStore } from "../../stores/harnessStore";
import { toast } from "../../stores/toastStore";
import { isLinuxDesktop } from "../../lib/windowActions";
import { SHOW_TERMINAL_DIAGNOSTICS_UI } from "./terminalConstants";
import { TerminalTabsBar } from "./TerminalTabsBar";
import type { TerminalGroup, TerminalNotification } from "../../types";

interface TerminalTabsProps {
  workspaceId: string;
  groups: TerminalGroup[];
  activeGroupId: string | null;
  sessions: Array<{ id: string; cwd: string }>;
  notificationsBySessionId: Record<string, TerminalNotification | null>;
  domFocusedSessionId: string | null;
  focusedSessionId: string | null;
  closeSession: (workspaceId: string, sessionId: string) => Promise<void>;
  copyTextToClipboard: (text: string) => Promise<void>;
  spawnNewSession: () => void;
  handleSplit: (direction: "horizontal" | "vertical") => void;
  copyRendererDiagnostics: (groupId?: string) => void;
  setNewTabMenuOpen: (open: boolean) => void;
  cachedTerminals: Map<string, import("./terminalTypes").SessionTerminal>;
  terminalCacheKey: (workspaceId: string, sessionId: string) => string;
}

export function TerminalTabs({
  workspaceId,
  groups,
  activeGroupId,
  sessions,
  notificationsBySessionId,
  domFocusedSessionId,
  focusedSessionId,
  closeSession,
  copyTextToClipboard,
  spawnNewSession,
  handleSplit,
  copyRendererDiagnostics,
  setNewTabMenuOpen,
  cachedTerminals,
  terminalCacheKey,
}: TerminalTabsProps) {
  const { t } = useTranslation("app");

  const setActiveGroup = useTerminalStore((state) => state.setActiveGroup);
  const reorderGroups = useTerminalStore((state) => state.reorderGroups);
  const renameGroup = useTerminalStore((state) => state.renameGroup);
  const getGroupWorktrees = useTerminalStore((state) => state.getGroupWorktrees);
  const removeGroupWorktrees = useTerminalStore((state) => state.removeGroupWorktrees);
  const setFocusedSession = useTerminalStore((state) => state.setFocusedSession);
  const linuxDesktop = isLinuxDesktop();

  const allHarnesses = useHarnessStore((s) => s.harnesses);
  const installedHarnesses = allHarnesses.filter((h) => h.found);
  const repos = useWorkspaceStore((state) => state.repos);
  const activeRepos = repos
    .filter((repo) => repo.isActive)
    .map((repo) => ({ path: repo.path, name: repo.name, defaultBranch: repo.defaultBranch }));

  // ── Tab state ──────────────────────────────────────────────────────
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const dragStateRef = useRef<{ groupId: string; startX: number; started: boolean; el: HTMLElement } | null>(null);
  const suppressClickRef = useRef(false);
  const tabsListRef = useRef<HTMLDivElement>(null);

  const [ctxMenu, setCtxMenu] = useState<{ groupId: string; x: number; y: number } | null>(null);
  const [terminalCtxMenu, setTerminalCtxMenu] = useState<{
    sessionId: string;
    x: number;
    y: number;
    selectionText: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [worktreeCloseGroupId, setWorktreeCloseGroupId] = useState<string | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (renamingGroupId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingGroupId]);

  useEffect(() => {
    if (renamingGroupId && !groups.some((g) => g.id === renamingGroupId)) {
      setRenamingGroupId(null);
    }
  }, [groups, renamingGroupId]);

  useEffect(() => {
    if (!ctxMenu && !terminalCtxMenu) return;
    const handleClose = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && menuRef.current?.contains(e.target as Node)) return;
      setCtxMenu(null);
      setTerminalCtxMenu(null);
    };
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", handleClose);
    };
  }, [ctxMenu, terminalCtxMenu]);

  // ── Rename handlers ──────────────────────────────────────────────────
  const commitRename = useCallback(
    (groupId: string) => {
      const trimmed = renameValue.trim();
      if (trimmed) {
        renameGroup(workspaceId, groupId, trimmed);
      }
      setRenamingGroupId(null);
    },
    [renameValue, renameGroup, workspaceId],
  );

  const cancelRename = useCallback(() => {
    setRenamingGroupId(null);
  }, []);

  const startRenameFromMenu = useCallback((groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setCtxMenu(null);
    setRenamingGroupId(groupId);
    setRenameValue(group.name);
  }, [groups]);

  // ── Close group ──────────────────────────────────────────────────────
  const closeGroupFromMenu = useCallback((groupId: string) => {
    setCtxMenu(null);
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    if (getGroupWorktrees(workspaceId, groupId).length > 0) {
      setWorktreeCloseGroupId(groupId);
      return;
    }
    for (const id of collectSessionIds(group.root)) {
      void closeSession(workspaceId, id);
    }
  }, [groups, closeSession, workspaceId, getGroupWorktrees]);

  // ── Worktree close dialog handlers ───────────────────────────────────
  const handleWorktreeCloseConfirm = useCallback(async () => {
    if (!worktreeCloseGroupId) return;
    const group = groups.find((g) => g.id === worktreeCloseGroupId);
    if (group) {
      const worktrees = getGroupWorktrees(workspaceId, group.id);
      const sessionIds = collectSessionIds(group.root);
      await Promise.all(sessionIds.map((id) => closeSession(workspaceId, id)));

      const remainingSessions = useTerminalStore.getState().workspaces[workspaceId]?.sessions ?? [];
      const stillOpen = sessionIds.filter((id) => remainingSessions.some((session) => session.id === id));
      if (stillOpen.length > 0) {
        toast.error(t("terminal.toasts.failedToCloseSessionsKept", { count: stillOpen.length }));
        setWorktreeCloseGroupId(null);
        return;
      }

      if (worktrees.length > 0) {
        try {
          await removeGroupWorktrees(workspaceId, worktrees);
        } catch (error) {
          toast.error(String(error));
        }
      }
    }
    setWorktreeCloseGroupId(null);
  }, [worktreeCloseGroupId, groups, getGroupWorktrees, removeGroupWorktrees, closeSession, t, workspaceId]);

  const handleWorktreeCloseCancel = useCallback(async () => {
    if (!worktreeCloseGroupId) return;
    const group = groups.find((g) => g.id === worktreeCloseGroupId);
    if (group) {
      const sessionIds = collectSessionIds(group.root);
      await Promise.all(sessionIds.map((id) => closeSession(workspaceId, id)));

      const remainingSessions = useTerminalStore.getState().workspaces[workspaceId]?.sessions ?? [];
      const stillOpen = sessionIds.filter((id) => remainingSessions.some((session) => session.id === id));
      if (stillOpen.length > 0) {
        toast.error(t("terminal.toasts.failedToCloseSessions", { count: stillOpen.length }));
      }
    }
    setWorktreeCloseGroupId(null);
  }, [worktreeCloseGroupId, groups, closeSession, t, workspaceId]);

  const dismissWorktreeCloseDialog = useCallback(() => {
    setWorktreeCloseGroupId(null);
  }, []);

  // ── Tab drag-and-drop ────────────────────────────────────────────────
  const handleTabPointerDown = useCallback((e: React.PointerEvent, groupId: string) => {
    if (renamingGroupId || groups.length <= 1 || e.button !== 0) return;
    const tabEl = e.currentTarget as HTMLElement;
    dragStateRef.current = { groupId, startX: e.clientX, started: false, el: tabEl };

    const onMove = (me: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      if (!ds.started) {
        if (Math.abs(me.clientX - ds.startX) < 5) return;
        ds.started = true;
        suppressClickRef.current = true;
        setDraggingGroupId(groupId);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      }

      const dx = me.clientX - ds.startX;
      ds.el.style.transform = `translateX(${dx}px)`;

      const listEl = tabsListRef.current;
      if (!listEl) return;
      const tabs = Array.from(listEl.children) as HTMLElement[];
      const currentGroups = useTerminalStore.getState().workspaces[workspaceId]?.groups ?? [];
      const curIdx = currentGroups.findIndex((g) => g.id === groupId);
      if (curIdx === -1) return;
      for (let i = 0; i < tabs.length; i++) {
        if (i === curIdx) continue;
        const rect = tabs[i].getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        if (i < curIdx && me.clientX < mid) {
          ds.startX -= rect.width;
          reorderGroups(workspaceId, curIdx, i);
          break;
        }
        if (i > curIdx && me.clientX > mid) {
          ds.startX += rect.width;
          reorderGroups(workspaceId, curIdx, i);
          break;
        }
      }
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      const ds = dragStateRef.current;
      if (ds?.started) {
        ds.el.style.transform = "";
        setDraggingGroupId(null);
        requestAnimationFrame(() => { suppressClickRef.current = false; });
      }
      dragStateRef.current = null;
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [renamingGroupId, groups.length, workspaceId, reorderGroups]);

  // ── Terminal context menu (Linux) ────────────────────────────────────
  const openTerminalContextMenu = useCallback(
    (sessionId: string, event: React.MouseEvent<HTMLDivElement>) => {
      if (!linuxDesktop) return;

      event.preventDefault();
      setFocusedSession(workspaceId, sessionId);
      setCtxMenu(null);

      const cached = cachedTerminals.get(terminalCacheKey(workspaceId, sessionId));
      setTerminalCtxMenu({
        sessionId,
        x: event.clientX,
        y: event.clientY,
        selectionText: cached?.terminal.getSelection() ?? "",
      });
    },
    [linuxDesktop, setFocusedSession, workspaceId, cachedTerminals, terminalCacheKey],
  );

  const copyTerminalSelection = useCallback(
    async (sessionId: string, selectionText: string) => {
      setTerminalCtxMenu(null);
      if (!selectionText) return;
      try {
        await copyTextToClipboard(selectionText);
      } catch (error) {
        toast.error(
          t("terminal.toasts.clipboardWriteFailed", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
    [t, copyTextToClipboard],
  );

  const pasteIntoTerminal = useCallback(
    async (sessionId: string) => {
      setTerminalCtxMenu(null);
      const cached = cachedTerminals.get(terminalCacheKey(workspaceId, sessionId));
      if (!cached) return;

      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          cached.terminal.paste(text);
        }
      } catch (error) {
        toast.error(
          t("terminal.toasts.clipboardReadFailed", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
    [t, workspaceId, cachedTerminals, terminalCacheKey],
  );

  return (
    <TerminalTabsBar
      workspaceId={workspaceId}
      groups={groups}
      activeGroupId={activeGroupId}
      sessions={sessions}
      notificationsBySessionId={notificationsBySessionId}
      draggingGroupId={draggingGroupId}
      domFocusedSessionId={domFocusedSessionId}
      installedHarnesses={installedHarnesses}
      repos={activeRepos}
      getGroupWorktrees={getGroupWorktrees}
      setActiveGroup={setActiveGroup}
      closeGroupFromMenu={closeGroupFromMenu}
      startRenameFromMenu={startRenameFromMenu}
      cancelRename={cancelRename}
      commitRename={commitRename}
      setCtxMenu={setCtxMenu}
      setTerminalCtxMenu={setTerminalCtxMenu}
      spawnNewSession={spawnNewSession}
      handleSplit={handleSplit}
      copyRendererDiagnostics={copyRendererDiagnostics}
      installedHarnessCount={installedHarnesses.length}
      onNewTabMenuOpen={setNewTabMenuOpen}
      renameInputRef={renameInputRef}
      renamingGroupId={renamingGroupId}
      renameValue={renameValue}
      setRenamingGroupId={setRenamingGroupId}
      setRenameValue={setRenameValue}
      suppressClickRef={suppressClickRef}
    />
  );
}

// Re-export for use in TerminalPanel
// Note: worktreeCloseGroupId, handleWorktreeCloseConfirm, handleWorktreeCloseCancel, dismissWorktreeCloseDialog
// are defined locally in this file and re-exported from TerminalPanel.tsx directly
