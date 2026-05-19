import { useCallback, useEffect, useRef, useState } from "react";
import { Columns2, Copy, GitBranch as GitBranchIcon, Plus, Radio, Rows2, SquareTerminal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getHarnessIcon } from "../shared/HarnessLogos";
import { useTerminalStore } from "../../stores/terminalStore";
import type { SplitNode, TerminalGroup, TerminalNotification } from "../../types";
import {
  collectSessionIds,
  getGroupDisplayHarness,
} from "../../stores/terminalStore";
import { SHOW_TERMINAL_DIAGNOSTICS_UI } from "./terminalConstants";

interface TerminalTabsBarProps {
  workspaceId: string;
  groups: TerminalGroup[];
  activeGroupId: string | null;
  sessions: Array<{ id: string; cwd: string }>;
  notificationsBySessionId: Record<string, TerminalNotification | null>;
  draggingGroupId: string | null;
  domFocusedSessionId: string | null;
  installedHarnesses: Array<{ id: string; name: string }>;
  repos: Array<{ path: string; name: string; defaultBranch: string }>;
  getGroupWorktrees: (workspaceId: string, groupId: string) => Array<{ branch: string }>;
  setActiveGroup: (workspaceId: string, groupId: string) => void;
  closeGroupFromMenu: (groupId: string) => void;
  startRenameFromMenu: (groupId: string) => void;
  cancelRename: () => void;
  commitRename: (groupId: string) => void;
  setCtxMenu: (menu: { groupId: string; x: number; y: number } | null) => void;
  setTerminalCtxMenu: (menu: {
    sessionId: string;
    x: number;
    y: number;
    selectionText: string;
  } | null) => void;
  spawnNewSession: () => void;
  handleSplit: (direction: "horizontal" | "vertical") => void;
  copyRendererDiagnostics: (groupId?: string) => void;
  installedHarnessCount: number;
  onNewTabMenuOpen?: (open: boolean) => void;
  renameInputRef?: React.RefObject<HTMLInputElement | null>;
  renamingGroupId?: string | null;
  renameValue?: string;
  setRenamingGroupId?: (id: string | null) => void;
  setRenameValue?: (value: string) => void;
  suppressClickRef?: React.RefObject<boolean>;
}

export function TerminalTabsBar({
  workspaceId,
  groups,
  activeGroupId,
  sessions,
  notificationsBySessionId,
  draggingGroupId,
  domFocusedSessionId,
  getGroupWorktrees,
  setActiveGroup,
  closeGroupFromMenu,
  startRenameFromMenu,
  cancelRename,
  commitRename,
  setCtxMenu,
  setTerminalCtxMenu,
  spawnNewSession,
  handleSplit,
  copyRendererDiagnostics,
  installedHarnessCount,
  onNewTabMenuOpen,
  renameInputRef: externalRenameInputRef,
  renamingGroupId: externalRenamingGroupId,
  renameValue: externalRenameValue,
  setRenamingGroupId: externalSetRenamingGroupId,
  setRenameValue: externalSetRenameValue,
  suppressClickRef: externalSuppressClickRef,
}: TerminalTabsBarProps) {
  const { t } = useTranslation("app");
  const workspaceState = useTerminalStore((state) => state.workspaces[workspaceId]);

  const [internalRenamingGroupId, setInternalRenamingGroupId] = useState<string | null>(null);
  const [internalRenameValue, setInternalRenameValue] = useState("");
  const internalRenameInputRef = useRef<HTMLInputElement>(null);
  const tabsListRef = useRef<HTMLDivElement>(null);

  const internalSuppressClickRef = useRef(false);

  const renamingGroupId = externalRenamingGroupId !== undefined ? externalRenamingGroupId : internalRenamingGroupId;
  const setRenamingGroupIdFn = externalSetRenamingGroupId ?? setInternalRenamingGroupId;
  const renameValue = externalRenameValue !== undefined ? externalRenameValue : internalRenameValue;
  const setRenameValueFn = externalSetRenameValue ?? setInternalRenameValue;
  const renameInputRef = externalRenameInputRef ?? internalRenameInputRef;
  const suppressClickRef = externalSuppressClickRef ?? internalSuppressClickRef;

  const handleTabPointerDown = useCallback((e: React.PointerEvent, groupId: string) => {
    if (e.button !== 0) return;
    suppressClickRef.current = true;
    setTimeout(() => { suppressClickRef.current = false; }, 200);
  }, [suppressClickRef]);

  return (
    <div className="terminal-tabs-bar">
      <div className="terminal-tabs-list" ref={tabsListRef}>
        {groups.map((group) => {
          const isActive = group.id === activeGroupId;
          const groupSessionIds = collectSessionIds(group.root);
          const groupNotification = groupSessionIds.reduce<TerminalNotification | null>(
            (latest, sessionId) => {
              const notification = notificationsBySessionId[sessionId] ?? null;
              if (!notification) {
                return latest;
              }
              if (!latest || notification.createdAt > latest.createdAt) {
                return notification;
              }
              return latest;
            },
            null,
          );
          const displayHarness = getGroupDisplayHarness(group);
          const groupWorktrees = getGroupWorktrees(workspaceId, group.id);
          const groupNotificationPreview = groupNotification
            ? `${groupNotification.title}: ${groupNotification.body}`
            : undefined;
          return (
            <div
              key={group.id}
              role="button"
              tabIndex={0}
              className={`terminal-tab${isActive ? " terminal-tab-active" : ""}${draggingGroupId === group.id ? " terminal-tab-dragging" : ""}`}
              title={groupNotificationPreview}
              onClick={() => {
                if (suppressClickRef.current) return;
                setActiveGroup(workspaceId, group.id);
              }}
              onPointerDown={(e) => handleTabPointerDown(e, group.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setTerminalCtxMenu(null);
                setCtxMenu({ groupId: group.id, x: e.clientX, y: e.clientY });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (suppressClickRef.current) return;
                  setActiveGroup(workspaceId, group.id);
                }
              }}
            >
              {displayHarness.harnessId
                ? getHarnessIcon(displayHarness.harnessId, 12)
                : <SquareTerminal size={12} />}
              {renamingGroupId === group.id ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  className="terminal-tab-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValueFn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitRename(group.id); }
                    if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                  }}
                  onBlur={() => commitRename(group.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="terminal-tab-label"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingGroupIdFn(group.id);
                    setRenameValueFn(group.name);
                  }}
                >
                  {group.name}
                </span>
              )}
              {groupWorktrees.length > 0 && (
                <span className="terminal-worktree-badge" title={groupWorktrees.map((worktree) => worktree.branch).join(", ")}>
                  <GitBranchIcon size={10} />
                </span>
              )}
              {groupNotification && (
                <span className="terminal-tab-notification-dot" aria-hidden="true" />
              )}
              {groupSessionIds.length > 1 && (
                <span className="terminal-tab-badge">{groupSessionIds.length}</span>
              )}
              <button
                type="button"
                className="terminal-tab-close"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeGroupFromMenu(group.id);
                }}
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="terminal-tabs-actions">
        <button
          type="button"
          className="terminal-add-btn"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (installedHarnessCount > 0) {
              onNewTabMenuOpen?.(true);
            } else {
              spawnNewSession();
            }
          }}
          title={t("terminal.newTerminal")}
        >
          <Plus size={13} />
        </button>
        {domFocusedSessionId && (
          <>
            <button
              type="button"
              className="terminal-add-btn"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSplit("vertical")}
              title={t("terminal.splitRight")}
            >
              <Columns2 size={13} />
            </button>
            <button
              type="button"
              className="terminal-add-btn"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSplit("horizontal")}
              title={t("terminal.splitDown")}
            >
              <Rows2 size={13} />
            </button>
            {(() => {
              const activeGroup = groups.find((g) => g.id === activeGroupId);
              const hasManyPanes = activeGroup && collectSessionIds(activeGroup.root).length > 1;
              if (!hasManyPanes) return null;
              const isBroadcasting = workspaceState?.broadcastGroupId === activeGroupId;
              return (
                <button
                  type="button"
                  className={`terminal-add-btn${isBroadcasting ? " terminal-broadcast-btn-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (activeGroupId) {
                      useTerminalStore.getState().toggleBroadcast(workspaceId, activeGroupId);
                    }
                  }}
                  title={
                    isBroadcasting
                      ? t("terminal.broadcastTitleOn")
                      : t("terminal.broadcastTitleOff")
                  }
                >
                  <Radio size={13} />
                </button>
              );
            })()}
            {SHOW_TERMINAL_DIAGNOSTICS_UI && (
              <button
                type="button"
                className="terminal-add-btn"
                onClick={() => void copyRendererDiagnostics()}
                title={t("terminal.copyRendererDiagnostics")}
              >
                <Copy size={13} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}