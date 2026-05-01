import { useEffect, useState } from "react";
import {
  Archive,
  ArrowRightCircle,
  FlaskConical,
  GitBranch,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  Server,
  Share2,
  SquareCode,
  Trash2,
  Undo2,
  UserCircle,
  X,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ipc } from "../../lib/ipc";
import { toast } from "../../stores/toastStore";
import type {
  CodexExperimentalFeature,
  CodexMcpServer,
  CodexReviewDelivery,
  CodexReviewTarget,
  CodexSkill,
  OpenCodeAgent,
  OpenCodeCommand,
  OpenCodeFileDiff,
  OpenCodeMcpServer,
  OpenCodeRemoteSession,
  OpenCodeRemoteSessionDetail,
  OpenCodeTodo,
  Thread,
} from "../../types";

type ReviewTargetMode =
  | "uncommittedChanges"
  | "baseBranch"
  | "commit"
  | "custom";

export type ActiveSlashCommand =
  | { type: "review" }
  | { type: "fork" }
  | { type: "rollback" }
  | { type: "compact" }
  | { type: "fast" }
  | { type: "personality" }
  | { type: "skills" }
  | { type: "agents" }
  | { type: "commands" }
  | { type: "sessions" }
  | { type: "mcp" }
  | { type: "experimental" };

export interface SlashCommandPayload {
  target?: CodexReviewTarget;
  delivery?: CodexReviewDelivery;
  numTurns?: number;
  serviceTier?: string;
  personality?: string;
}

interface ChatCommandPanelProps {
  command: ActiveSlashCommand;
  busy: boolean;
  error: string | null;
  defaultBaseBranch: string | null;
  /** Current values for config commands */
  currentServiceTier?: string;
  currentPersonality?: string;
  personalitySupported?: boolean;
  /** Data for info panels */
  skills?: CodexSkill[];
  openCodeAgents?: OpenCodeAgent[];
  openCodeCommands?: OpenCodeCommand[];
  openCodeMcpServers?: OpenCodeMcpServer[];
  workspaceId?: string | null;
  selectedModelId?: string | null;
  onAttachOpenCodeSession?: (session: OpenCodeRemoteSession) => Promise<void>;
  onOpenThread?: (thread: Thread) => Promise<void>;
  mcpServers?: CodexMcpServer[];
  experimentalFeatures?: CodexExperimentalFeature[];
  onConfirm: (
    command: ActiveSlashCommand,
    payload?: SlashCommandPayload,
  ) => void;
  onDismiss: () => void;
}

export function ChatCommandPanel({
  command,
  busy,
  error,
  defaultBaseBranch,
  currentServiceTier,
  currentPersonality,
  personalitySupported,
  skills,
  openCodeAgents,
  openCodeCommands,
  openCodeMcpServers,
  workspaceId,
  selectedModelId,
  onAttachOpenCodeSession,
  onOpenThread,
  mcpServers,
  experimentalFeatures,
  onConfirm,
  onDismiss,
}: ChatCommandPanelProps) {
  const { t } = useTranslation("chat");

  switch (command.type) {
    case "review":
      return (
        <ReviewPanel
          busy={busy}
          error={error}
          defaultBaseBranch={defaultBaseBranch}
          onConfirm={(target, delivery) =>
            onConfirm(command, { target, delivery })
          }
          onDismiss={onDismiss}
          t={t}
        />
      );
    case "fork":
      return (
        <ConfirmPanel
          icon={GitBranch}
          title={t("threadPicker.forkTitle")}
          description={t("threadPicker.forkDescription")}
          confirmLabel={t("threadPicker.forkAction")}
          busy={busy}
          error={error}
          onConfirm={() => onConfirm(command)}
          onDismiss={onDismiss}
        />
      );
    case "rollback":
      return (
        <RollbackPanel
          busy={busy}
          error={error}
          onConfirm={(numTurns) => onConfirm(command, { numTurns })}
          onDismiss={onDismiss}
          t={t}
        />
      );
    case "fast":
      // /fast is handled as a direct toggle in ChatPanel — no panel needed
      return null;
    case "personality":
      return (
        <OptionPickerPanel
          busy={busy}
          error={error}
          icon={UserCircle}
          title={t("configPicker.personality")}
          description={
            personalitySupported
              ? t("configPicker.personalityDescription")
              : t("configPicker.personalityUnsupported")
          }
          options={[
            { value: "inherit", label: t("configPicker.inherit") },
            { value: "none", label: t("configPicker.personalities.none") },
            { value: "friendly", label: t("configPicker.personalities.friendly") },
            { value: "pragmatic", label: t("configPicker.personalities.pragmatic") },
          ]}
          currentValue={currentPersonality ?? "inherit"}
          onSelect={(value) => onConfirm(command, { personality: value })}
          onDismiss={onDismiss}
        />
      );
    case "compact":
      return (
        <ConfirmPanel
          icon={Minimize2}
          title={t("threadPicker.compactTitle")}
          description={t("threadPicker.compactDescription")}
          confirmLabel={t("threadPicker.compactAction")}
          busy={busy}
          error={error}
          onConfirm={() => onConfirm(command)}
          onDismiss={onDismiss}
        />
      );
    case "skills":
      return (
        <InfoListPanel
          icon={Scissors}
          title={t("slashCommands.panels.skills.title")}
          emptyLabel={t("slashCommands.panels.skills.empty")}
          items={(skills ?? []).map((s) => ({
            name: s.name,
            detail: s.description || s.scope,
            enabled: s.enabled,
          }))}
          onDismiss={onDismiss}
        />
      );
    case "agents":
      return (
        <InfoListPanel
          icon={UserCircle}
          title={t("slashCommands.panels.openCodeAgents.title")}
          emptyLabel={t("slashCommands.panels.openCodeAgents.empty")}
          items={(openCodeAgents ?? []).map((agent) => ({
            name: agent.name,
            detail: agent.description || agent.mode,
            badge: agent.mode,
          }))}
          onDismiss={onDismiss}
        />
      );
    case "commands":
      return (
        <InfoListPanel
          icon={SquareCode}
          title={t("slashCommands.panels.openCodeCommands.title")}
          emptyLabel={t("slashCommands.panels.openCodeCommands.empty")}
          items={(openCodeCommands ?? []).map((command) => ({
            name: `/${command.name}`,
            detail: command.description || command.hints.join(" "),
            badge: command.source ?? (command.subtask ? "subtask" : undefined),
          }))}
          onDismiss={onDismiss}
        />
      );
    case "sessions":
      return (
        <OpenCodeSessionsPanel
          busy={busy}
          error={error}
          workspaceId={workspaceId}
          selectedModelId={selectedModelId}
          onAttach={onAttachOpenCodeSession}
          onOpenThread={onOpenThread}
          onDismiss={onDismiss}
          t={t}
        />
      );
    case "mcp":
      return (
        <InfoListPanel
          icon={Server}
          title={t("slashCommands.panels.mcp.title")}
          emptyLabel={t("slashCommands.panels.mcp.empty")}
          items={
            openCodeMcpServers
              ? openCodeMcpServers.map((server) => ({
                  name: server.name,
                  detail: server.detail ?? server.status,
                  badge: server.status,
                }))
              : (mcpServers ?? []).map((s) => ({
                  name: s.name,
                  detail: `${s.toolCount} tools, ${s.resourceCount} resources`,
                  badge: s.authStatus,
                }))
          }
          onDismiss={onDismiss}
        />
      );
    case "experimental":
      return (
        <InfoListPanel
          icon={FlaskConical}
          title={t("slashCommands.panels.experimental.title")}
          emptyLabel={t("slashCommands.panels.experimental.empty")}
          items={(experimentalFeatures ?? []).map((f) => ({
            name: f.displayName || f.name,
            detail: f.stage,
            enabled: f.enabled,
          }))}
          onDismiss={onDismiss}
        />
      );
  }
}

type OpenCodeSessionFilter = "active" | "archived";

function formatRemoteSessionTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function describeOpenCodeSession(session: OpenCodeRemoteSession): string {
  const title = session.title?.trim();
  return title || session.engineThreadId;
}

function OpenCodeSessionsPanel({
  busy,
  error,
  workspaceId,
  selectedModelId,
  onAttach,
  onOpenThread,
  onDismiss,
  t,
}: {
  busy: boolean;
  error: string | null;
  workspaceId?: string | null;
  selectedModelId?: string | null;
  onAttach?: (session: OpenCodeRemoteSession) => Promise<void>;
  onOpenThread?: (thread: Thread) => Promise<void>;
  onDismiss: () => void;
  t: ReturnType<typeof useTranslation<"chat">>["t"];
}) {
  const [sessions, setSessions] = useState<OpenCodeRemoteSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<OpenCodeRemoteSessionDetail | null>(null);
  const [children, setChildren] = useState<OpenCodeRemoteSession[]>([]);
  const [todos, setTodos] = useState<OpenCodeTodo[]>([]);
  const [diffs, setDiffs] = useState<OpenCodeFileDiff[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<OpenCodeSessionFilter>("active");
  const [localBusy, setLocalBusy] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [revertMessageId, setRevertMessageId] = useState("");
  const [revertPartId, setRevertPartId] = useState("");
  const browsingDisabled = !workspaceId || !selectedModelId || !onAttach;
  const blocked = busy || localBusy !== null;
  const displayError = error || localError;
  const selectedSession =
    sessions.find((session) => session.engineThreadId === selectedSessionId) ?? null;
  const selectedAttachBusy = selectedSession
    ? localBusy === `attach:${selectedSession.engineThreadId}`
    : false;

  async function loadSessions(reset: boolean) {
    if (!workspaceId) {
      setSessions([]);
      setSelectedSessionId(null);
      setSessionDetail(null);
      setChildren([]);
      setTodos([]);
      setDiffs([]);
      setNextCursor(null);
      setLoaded(true);
      return;
    }

    const cursor = reset ? null : nextCursor;
    setLocalBusy(reset ? "refresh" : "more");
    if (reset) {
      setLocalError(null);
      setLoaded(false);
      setNextCursor(null);
    }

    try {
      const page = await ipc.listOpenCodeRemoteSessions(workspaceId, {
        cursor,
        limit: 20,
        searchTerm: searchQuery || null,
        archived: filter === "archived",
      });
      setSessions((current) => {
        const nextSessions = reset
          ? page.sessions
          : [
              ...current,
              ...page.sessions.filter(
                (session) =>
                  !new Set(current.map((currentSession) => currentSession.engineThreadId)).has(
                    session.engineThreadId,
                  ),
              ),
            ];
        if (reset) {
          const preferredSessionId =
            nextSessions.find((session) => session.engineThreadId === selectedSessionId)
              ?.engineThreadId ??
            nextSessions[0]?.engineThreadId ??
            null;
          setSelectedSessionId(preferredSessionId);
        }
        return nextSessions;
      });
      setNextCursor(page.nextCursor ?? null);
      setLoaded(true);
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
      if (reset) {
        setSessions([]);
        setSelectedSessionId(null);
        setSessionDetail(null);
        setChildren([]);
        setTodos([]);
        setDiffs([]);
        setNextCursor(null);
        setLoaded(true);
      }
    } finally {
      setLocalBusy(null);
    }
  }

  useEffect(() => {
    void loadSessions(true);
  }, [filter, searchQuery, workspaceId]);

  useEffect(() => {
    setSessionDetail(null);
    setChildren([]);
    setTodos([]);
    setDiffs([]);
    setRevertMessageId("");
    setRevertPartId("");

    if (!workspaceId || !selectedSession) {
      return;
    }

    let active = true;
    setLocalBusy((current) => current ?? `inspect:${selectedSession.engineThreadId}`);
    setLocalError(null);
    void Promise.all([
      ipc.getOpenCodeRemoteSessionDetail(
        workspaceId,
        selectedSession.engineThreadId,
        selectedSession.cwd,
      ),
      ipc.listOpenCodeRemoteSessionChildren(
        workspaceId,
        selectedSession.engineThreadId,
        selectedSession.cwd,
      ),
      ipc.getOpenCodeRemoteSessionTodos(
        workspaceId,
        selectedSession.engineThreadId,
        selectedSession.cwd,
      ),
      ipc.getOpenCodeRemoteSessionDiff(
        workspaceId,
        selectedSession.engineThreadId,
        selectedSession.cwd,
      ),
    ])
      .then(([detail, nextChildren, nextTodos, nextDiffs]) => {
        if (!active) {
          return;
        }
        setSessionDetail(detail);
        setChildren(nextChildren);
        setTodos(nextTodos);
        setDiffs(nextDiffs);
      })
      .catch((nextError) => {
        if (!active) {
          return;
        }
        setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setLocalBusy((current) =>
          current === `inspect:${selectedSession.engineThreadId}` ? null : current,
        );
      });

    return () => {
      active = false;
    };
  }, [selectedSessionId, sessions, workspaceId]);

  async function handleAttach(session: OpenCodeRemoteSession) {
    if (!onAttach) {
      return;
    }
    setLocalBusy(`attach:${session.engineThreadId}`);
    setLocalError(null);
    try {
      await onAttach(session);
      onDismiss();
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLocalBusy(null);
    }
  }

  async function handleOpenThread(thread: Thread) {
    if (!onOpenThread) {
      return;
    }
    await onOpenThread(thread);
    onDismiss();
  }

  async function handleFork(session: OpenCodeRemoteSession) {
    if (!workspaceId || !selectedModelId) {
      return;
    }
    setLocalBusy(`fork:${session.engineThreadId}`);
    setLocalError(null);
    try {
      const thread = await ipc.forkOpenCodeRemoteSession(
        workspaceId,
        session.engineThreadId,
        session.cwd,
        selectedModelId,
      );
      toast.success(t("panel.toasts.openCodeThreadForked"));
      await handleOpenThread(thread);
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLocalBusy(null);
    }
  }

  async function handleSummarize(session: OpenCodeRemoteSession) {
    if (!workspaceId || !selectedModelId) {
      return;
    }
    setLocalBusy(`summarize:${session.engineThreadId}`);
    setLocalError(null);
    try {
      await ipc.summarizeOpenCodeRemoteSession(
        workspaceId,
        session.engineThreadId,
        session.cwd,
        selectedModelId,
        false,
      );
      toast.success(t("panel.toasts.openCodeThreadCompactionStarted"));
      await loadSessions(true);
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLocalBusy(null);
    }
  }

  async function handleShareToggle(session: OpenCodeRemoteSession, shared: boolean) {
    if (!workspaceId) {
      return;
    }
    setLocalBusy(`share:${session.engineThreadId}`);
    setLocalError(null);
    try {
      const detail = shared
        ? await ipc.unshareOpenCodeRemoteSession(
            workspaceId,
            session.engineThreadId,
            session.cwd,
          )
        : await ipc.shareOpenCodeRemoteSession(
            workspaceId,
            session.engineThreadId,
            session.cwd,
          );
      setSessionDetail(detail);
      toast.success(
        t(shared ? "panel.toasts.openCodeSessionUnshared" : "panel.toasts.openCodeSessionShared"),
      );
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLocalBusy(null);
    }
  }

  async function handleArchiveToggle(session: OpenCodeRemoteSession) {
    if (!workspaceId) {
      return;
    }
    setLocalBusy(`archive:${session.engineThreadId}`);
    setLocalError(null);
    try {
      if (session.archived) {
        await ipc.unarchiveOpenCodeRemoteSession(
          workspaceId,
          session.engineThreadId,
          session.cwd,
        );
      } else {
        await ipc.archiveOpenCodeRemoteSession(
          workspaceId,
          session.engineThreadId,
          session.cwd,
        );
      }
      await loadSessions(true);
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLocalBusy(null);
    }
  }

  async function handleDelete(session: OpenCodeRemoteSession) {
    if (!workspaceId) {
      return;
    }
    setLocalBusy(`delete:${session.engineThreadId}`);
    setLocalError(null);
    try {
      await ipc.deleteOpenCodeRemoteSession(
        workspaceId,
        session.engineThreadId,
        session.cwd,
      );
      setSessions((current) =>
        current.filter((item) => item.engineThreadId !== session.engineThreadId),
      );
      if (selectedSessionId === session.engineThreadId) {
        setSelectedSessionId(null);
        setSessionDetail(null);
        setChildren([]);
        setTodos([]);
        setDiffs([]);
      }
      toast.success(t("panel.toasts.openCodeSessionDeleted"));
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLocalBusy(null);
    }
  }

  async function handleUnrevert(session: OpenCodeRemoteSession) {
    if (!workspaceId) {
      return;
    }
    setLocalBusy(`unrevert:${session.engineThreadId}`);
    setLocalError(null);
    try {
      const detail = await ipc.unrevertOpenCodeRemoteSession(
        workspaceId,
        session.engineThreadId,
        session.cwd,
      );
      setSessionDetail(detail);
      toast.success(t("panel.toasts.openCodeSessionUnreverted"));
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLocalBusy(null);
    }
  }

  async function handleRevert(session: OpenCodeRemoteSession) {
    if (!workspaceId) {
      return;
    }
    const messageId = revertMessageId.trim();
    const partId = revertPartId.trim();
    if (!messageId) {
      setLocalError(t("slashCommands.panels.openCodeSessions.revertMessageRequired"));
      return;
    }
    setLocalBusy(`revert:${session.engineThreadId}`);
    setLocalError(null);
    try {
      const detail = await ipc.revertOpenCodeRemoteSession(
        workspaceId,
        session.engineThreadId,
        session.cwd,
        messageId,
        partId || null,
      );
      setSessionDetail(detail);
      toast.success(t("panel.toasts.openCodeSessionReverted"));
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLocalBusy(null);
    }
  }

  return (
    <div className="chat-command-panel">
      <div className="chat-command-panel-header">
        <div className="chat-command-panel-title">
          <GitBranch size={12} />
          <span>{t("slashCommands.panels.openCodeSessions.title")}</span>
        </div>
        <button
          type="button"
          className="chat-command-panel-close"
          onClick={onDismiss}
          disabled={blocked}
        >
          <X size={12} />
        </button>
      </div>
      <div className="chat-command-panel-desc">
        {t("slashCommands.panels.openCodeSessions.description")}
      </div>

      <div className="chat-command-panel-fields">
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}>
          <input
            className="chat-command-panel-input"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setSearchQuery(searchDraft.trim());
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onDismiss();
              }
            }}
            placeholder={t("slashCommands.panels.openCodeSessions.searchPlaceholder")}
            disabled={blocked || browsingDisabled}
            autoFocus
          />
          <select
            className="chat-command-panel-input"
            value={filter}
            onChange={(event) => setFilter(event.target.value as OpenCodeSessionFilter)}
            disabled={blocked || browsingDisabled}
          >
            <option value="active">
              {t("slashCommands.panels.openCodeSessions.filters.active")}
            </option>
            <option value="archived">
              {t("slashCommands.panels.openCodeSessions.filters.archived")}
            </option>
          </select>
          <button
            type="button"
            className="chat-command-panel-btn-secondary"
            onClick={() => setSearchQuery(searchDraft.trim())}
            disabled={blocked || browsingDisabled}
          >
            <Search size={11} />
            {t("threadPicker.searchAction")}
          </button>
        </div>

        <div className="chat-command-panel-desc">
          {browsingDisabled
            ? t("slashCommands.panels.openCodeSessions.unavailable")
            : t("slashCommands.panels.openCodeSessions.historyNote")}
        </div>
      </div>

      {displayError && <div className="chat-command-panel-error">{displayError}</div>}

      <div style={{ display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" }}>
        {!loaded && localBusy === "refresh" ? (
          <div className="chat-command-panel-desc">
            {t("slashCommands.panels.openCodeSessions.loading")}
          </div>
        ) : null}
        {loaded && sessions.length === 0 && !browsingDisabled ? (
          <div className="chat-command-panel-desc">
            {t("slashCommands.panels.openCodeSessions.empty")}
          </div>
        ) : null}
        {sessions.map((session) => {
          const label = describeOpenCodeSession(session);
          const attachBusy = localBusy === `attach:${session.engineThreadId}`;
          const selected = selectedSessionId === session.engineThreadId;
          return (
            <button
              key={session.engineThreadId}
              type="button"
              className="chat-command-panel-list-item"
              onClick={() => setSelectedSessionId(session.engineThreadId)}
              style={{
                textAlign: "left",
                borderColor: selected ? "var(--accent)" : undefined,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="chat-command-panel-list-name" title={label}>
                  {label}
                </div>
                <div className="chat-command-panel-list-detail" title={session.cwd}>
                  {session.cwd}
                </div>
                <div className="chat-command-panel-list-detail">
                  {t("slashCommands.panels.openCodeSessions.meta", {
                    updatedAt: formatRemoteSessionTimestamp(session.updatedAt),
                  })}
                </div>
              </div>
              <span className="chat-command-panel-info-badge">
                {session.archived
                  ? t("slashCommands.panels.openCodeSessions.filters.archived")
                  : t("slashCommands.panels.openCodeSessions.filters.active")}
              </span>
            </button>
          );
        })}
      </div>

      {selectedSession ? (
        <div className="chat-command-panel-fields">
          <div className="chat-command-panel-field">
            <span className="chat-command-panel-field-label">
              {t("slashCommands.panels.openCodeSessions.selected")}
            </span>
            <div className="chat-command-panel-desc">{describeOpenCodeSession(selectedSession)}</div>
            <div className="chat-command-panel-hint">{selectedSession.cwd}</div>
          </div>

          <div className="chat-command-panel-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <button
              type="button"
              className="chat-command-panel-btn-primary"
              onClick={() => void handleAttach(selectedSession)}
              disabled={blocked || browsingDisabled}
            >
              <ArrowRightCircle size={11} />
              {selectedAttachBusy
                ? t("threadPicker.working")
                : selectedSession.localThreadId
                  ? t("threadPicker.openAttachedAction")
                  : t("threadPicker.attachAction")}
            </button>
            <button
              type="button"
              className="chat-command-panel-btn-secondary"
              onClick={() => void handleFork(selectedSession)}
              disabled={blocked || browsingDisabled}
            >
              <GitBranch size={11} />
              {t("threadPicker.forkAction")}
            </button>
            <button
              type="button"
              className="chat-command-panel-btn-secondary"
              onClick={() => void handleSummarize(selectedSession)}
              disabled={blocked || browsingDisabled}
            >
              <Scissors size={11} />
              {t("threadPicker.compactAction")}
            </button>
            <button
              type="button"
              className="chat-command-panel-btn-secondary"
              onClick={() =>
                void handleShareToggle(selectedSession, Boolean(sessionDetail?.shareUrl))
              }
              disabled={blocked || !workspaceId}
            >
              <Share2 size={11} />
              {sessionDetail?.shareUrl
                ? t("slashCommands.panels.openCodeSessions.unshareAction")
                : t("slashCommands.panels.openCodeSessions.shareAction")}
            </button>
            <button
              type="button"
              className="chat-command-panel-btn-secondary"
              onClick={() => void handleArchiveToggle(selectedSession)}
              disabled={blocked || !workspaceId}
            >
              <Archive size={11} />
              {selectedSession.archived
                ? t("slashCommands.panels.openCodeSessions.restoreAction")
                : t("slashCommands.panels.openCodeSessions.archiveAction")}
            </button>
            {sessionDetail?.revert ? (
              <button
                type="button"
                className="chat-command-panel-btn-secondary"
                onClick={() => void handleUnrevert(selectedSession)}
                disabled={blocked || !workspaceId}
              >
                <Undo2 size={11} />
                {t("slashCommands.panels.openCodeSessions.unrevertAction")}
              </button>
            ) : null}
            <button
              type="button"
              className="chat-command-panel-btn-secondary chat-command-panel-btn-danger"
              onClick={() => void handleDelete(selectedSession)}
              disabled={blocked || !workspaceId}
            >
              <Trash2 size={11} />
              {t("slashCommands.panels.openCodeSessions.deleteAction")}
            </button>
          </div>

          {sessionDetail?.shareUrl ? (
            <div className="chat-command-panel-field">
              <span className="chat-command-panel-field-label">
                {t("slashCommands.panels.openCodeSessions.shareUrl")}
              </span>
              <div className="chat-command-panel-hint">{sessionDetail.shareUrl}</div>
            </div>
          ) : null}

          {sessionDetail?.summary ? (
            <div className="chat-command-panel-field">
              <span className="chat-command-panel-field-label">
                {t("slashCommands.panels.openCodeSessions.summary")}
              </span>
              <div className="chat-command-panel-hint">
                {t("slashCommands.panels.openCodeSessions.summaryMeta", {
                  files: sessionDetail.summary.files,
                  additions: sessionDetail.summary.additions,
                  deletions: sessionDetail.summary.deletions,
                })}
              </div>
            </div>
          ) : null}

          {sessionDetail?.revert ? (
            <div className="chat-command-panel-field">
              <span className="chat-command-panel-field-label">
                {t("slashCommands.panels.openCodeSessions.revertState")}
              </span>
              <div className="chat-command-panel-hint">
                {t("slashCommands.panels.openCodeSessions.revertMeta", {
                  messageId: sessionDetail.revert.messageId,
                  partId: sessionDetail.revert.partId || "-",
                })}
              </div>
            </div>
          ) : (
            <div className="chat-command-panel-field">
              <span className="chat-command-panel-field-label">
                {t("slashCommands.panels.openCodeSessions.revertAction")}
              </span>
              <input
                className="chat-command-panel-input"
                value={revertMessageId}
                onChange={(event) => setRevertMessageId(event.target.value)}
                placeholder={t("slashCommands.panels.openCodeSessions.revertMessagePlaceholder")}
                disabled={blocked || !workspaceId}
              />
              <input
                className="chat-command-panel-input"
                value={revertPartId}
                onChange={(event) => setRevertPartId(event.target.value)}
                placeholder={t("slashCommands.panels.openCodeSessions.revertPartPlaceholder")}
                disabled={blocked || !workspaceId}
              />
              <div className="chat-command-panel-actions" style={{ justifyContent: "flex-start" }}>
                <button
                  type="button"
                  className="chat-command-panel-btn-secondary"
                  onClick={() => void handleRevert(selectedSession)}
                  disabled={blocked || !workspaceId}
                >
                  <Undo2 size={11} />
                  {t("slashCommands.panels.openCodeSessions.revertAction")}
                </button>
              </div>
            </div>
          )}

          {todos.length > 0 ? (
            <div className="chat-command-panel-field">
              <span className="chat-command-panel-field-label">
                {t("slashCommands.panels.openCodeSessions.todos")}
              </span>
              <div className="chat-command-panel-info-list">
                {todos.map((todo, index) => (
                  <div
                    key={`${todo.content}-${index}`}
                    className="chat-command-panel-info-item"
                  >
                    <span className="chat-command-panel-info-name">{todo.content}</span>
                    <span className="chat-command-panel-info-detail">
                      {todo.priority}
                    </span>
                    <span className="chat-command-panel-info-badge">{todo.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {children.length > 0 ? (
            <div className="chat-command-panel-field">
              <span className="chat-command-panel-field-label">
                {t("slashCommands.panels.openCodeSessions.children")}
              </span>
              <div className="chat-command-panel-info-list">
                {children.map((child) => (
                  <div key={child.engineThreadId} className="chat-command-panel-info-item">
                    <span className="chat-command-panel-info-name">
                      {describeOpenCodeSession(child)}
                    </span>
                    <span className="chat-command-panel-info-detail">{child.cwd}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {diffs.length > 0 ? (
            <div className="chat-command-panel-field">
              <span className="chat-command-panel-field-label">
                {t("slashCommands.panels.openCodeSessions.diff")}
              </span>
              <div className="chat-command-panel-info-list">
                {diffs.map((diff) => (
                  <div key={diff.file} className="chat-command-panel-info-item">
                    <span className="chat-command-panel-info-name">{diff.file}</span>
                    <span className="chat-command-panel-info-detail">
                      {t("slashCommands.panels.openCodeSessions.diffMeta", {
                        additions: diff.additions,
                        deletions: diff.deletions,
                        status: diff.status || "modified",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="chat-command-panel-actions">
        <button
          type="button"
          className="chat-command-panel-btn-secondary"
          onClick={() => void loadSessions(true)}
          disabled={blocked || browsingDisabled}
        >
          <RefreshCw size={11} />
          {localBusy === "refresh" ? t("threadPicker.working") : t("threadPicker.refreshAction")}
        </button>
        <button
          type="button"
          className="chat-command-panel-btn-secondary"
          onClick={() => void loadSessions(false)}
          disabled={blocked || browsingDisabled || !nextCursor}
        >
          <RefreshCw size={11} />
          {localBusy === "more" ? t("threadPicker.working") : t("threadPicker.loadMoreAction")}
        </button>
      </div>
    </div>
  );
}

/* ── Generic confirm panel (fork / compact) ── */

function ConfirmPanel({
  icon: Icon,
  title,
  description,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onDismiss,
}: {
  icon: typeof GitBranch;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("chat");
  return (
    <div className="chat-command-panel">
      <div className="chat-command-panel-header">
        <div className="chat-command-panel-title">
          <Icon size={12} />
          <span>{title}</span>
        </div>
        <button
          type="button"
          className="chat-command-panel-close"
          onClick={onDismiss}
        >
          <X size={12} />
        </button>
      </div>
      <div className="chat-command-panel-desc">{description}</div>
      {error && <div className="chat-command-panel-error">{error}</div>}
      <div className="chat-command-panel-actions">
        <button
          type="button"
          className="chat-command-panel-btn-secondary"
          onClick={onDismiss}
          disabled={busy}
        >
          {t("panel.approvalActions.cancel")}
        </button>
        <button
          type="button"
          className="chat-command-panel-btn-primary"
          onClick={onConfirm}
          disabled={busy}
        >
          <Icon size={11} />
          {busy ? t("threadPicker.working") : confirmLabel}
        </button>
      </div>
    </div>
  );
}

/* ── Option picker panel (fast / personality / effort) ── */

function OptionPickerPanel({
  busy,
  error,
  icon: Icon,
  title,
  description,
  options,
  currentValue,
  onSelect,
  onDismiss,
}: {
  busy: boolean;
  error: string | null;
  icon: typeof Zap;
  title: string;
  description: string;
  options: { value: string; label: string }[];
  currentValue: string;
  onSelect: (value: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="chat-command-panel">
      <div className="chat-command-panel-header">
        <div className="chat-command-panel-title">
          <Icon size={12} />
          <span>{title}</span>
        </div>
        <button
          type="button"
          className="chat-command-panel-close"
          onClick={onDismiss}
          disabled={busy}
        >
          <X size={12} />
        </button>
      </div>
      {description && (
        <div className="chat-command-panel-desc">{description}</div>
      )}
      {error && <div className="chat-command-panel-error">{error}</div>}
      <div className="chat-command-panel-toggle-group">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`chat-command-panel-toggle${opt.value === currentValue ? " chat-command-panel-toggle-active" : ""}`}
            onClick={() => onSelect(opt.value)}
            disabled={busy}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Rollback panel ── */

function RollbackPanel({
  busy,
  error,
  onConfirm,
  onDismiss,
  t,
}: {
  busy: boolean;
  error: string | null;
  onConfirm: (numTurns: number) => void;
  onDismiss: () => void;
  t: ReturnType<typeof useTranslation<"chat">>["t"];
}) {
  const [turnsText, setTurnsText] = useState("1");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleConfirm() {
    const parsed = Number.parseInt(turnsText.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setLocalError(t("threadPicker.invalidTurns"));
      return;
    }
    setLocalError(null);
    onConfirm(parsed);
  }

  const displayError = error || localError;

  return (
    <div className="chat-command-panel">
      <div className="chat-command-panel-header">
        <div className="chat-command-panel-title">
          <RotateCcw size={12} />
          <span>{t("threadPicker.rollbackTitle")}</span>
        </div>
        <button
          type="button"
          className="chat-command-panel-close"
          onClick={onDismiss}
        >
          <X size={12} />
        </button>
      </div>
      <div className="chat-command-panel-desc">
        {t("threadPicker.rollbackDescription")}
      </div>
      <div className="chat-command-panel-fields">
        <label className="chat-command-panel-field">
          <span className="chat-command-panel-field-label">
            {t("threadPicker.rollbackTurns")}
          </span>
          <input
            className="chat-command-panel-input"
            type="number"
            min={1}
            value={turnsText}
            onChange={(e) => setTurnsText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onDismiss();
              }
            }}
            disabled={busy}
            autoFocus
          />
        </label>
        <div className="chat-command-panel-warning">
          {t("threadPicker.rollbackWarning")}
        </div>
      </div>
      {displayError && (
        <div className="chat-command-panel-error">{displayError}</div>
      )}
      <div className="chat-command-panel-actions">
        <button
          type="button"
          className="chat-command-panel-btn-secondary"
          onClick={onDismiss}
          disabled={busy}
        >
          {t("panel.approvalActions.cancel")}
        </button>
        <button
          type="button"
          className="chat-command-panel-btn-primary"
          onClick={handleConfirm}
          disabled={busy}
        >
          <RotateCcw size={11} />
          {busy ? t("threadPicker.working") : t("threadPicker.rollbackAction")}
        </button>
      </div>
    </div>
  );
}

/* ── Review panel ── */

function ReviewPanel({
  busy,
  error,
  defaultBaseBranch,
  onConfirm,
  onDismiss,
  t,
}: {
  busy: boolean;
  error: string | null;
  defaultBaseBranch: string | null;
  onConfirm: (target: CodexReviewTarget, delivery: CodexReviewDelivery) => void;
  onDismiss: () => void;
  t: ReturnType<typeof useTranslation<"chat">>["t"];
}) {
  const [targetMode, setTargetMode] =
    useState<ReviewTargetMode>("uncommittedChanges");
  const [delivery, setDelivery] = useState<CodexReviewDelivery>("inline");
  const [baseBranch, setBaseBranch] = useState(defaultBaseBranch ?? "");
  const [commitSha, setCommitSha] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setBaseBranch(defaultBaseBranch ?? "");
  }, [defaultBaseBranch]);

  function handleConfirm() {
    let target: CodexReviewTarget;

    if (targetMode === "uncommittedChanges") {
      target = { type: "uncommittedChanges" };
    } else if (targetMode === "baseBranch") {
      const branch = baseBranch.trim();
      if (!branch) {
        setLocalError(t("reviewPicker.errors.branchRequired"));
        return;
      }
      target = { type: "baseBranch", branch };
    } else if (targetMode === "commit") {
      const sha = commitSha.trim();
      if (!sha) {
        setLocalError(t("reviewPicker.errors.commitRequired"));
        return;
      }
      target = { type: "commit", sha };
    } else {
      const instructions = customInstructions.trim();
      if (!instructions) {
        setLocalError(t("reviewPicker.errors.instructionsRequired"));
        return;
      }
      target = { type: "custom", instructions };
    }

    setLocalError(null);
    onConfirm(target, delivery);
  }

  const displayError = error || localError;

  return (
    <div className="chat-command-panel">
      <div className="chat-command-panel-header">
        <div className="chat-command-panel-title">
          <Search size={12} />
          <span>{t("reviewPicker.title")}</span>
        </div>
        <button
          type="button"
          className="chat-command-panel-close"
          onClick={onDismiss}
        >
          <X size={12} />
        </button>
      </div>
      <div className="chat-command-panel-desc">
        {t("reviewPicker.subtitle")}
      </div>

      <div className="chat-command-panel-fields">
        <label className="chat-command-panel-field">
          <span className="chat-command-panel-field-label">
            {t("reviewPicker.targetLabel")}
          </span>
          <div className="chat-command-panel-toggle-group">
            {([
              { value: "uncommittedChanges", label: t("reviewPicker.targets.uncommittedChanges") },
              { value: "baseBranch", label: t("reviewPicker.targets.baseBranch") },
              { value: "commit", label: t("reviewPicker.targets.commit") },
              { value: "custom", label: t("reviewPicker.targets.custom") },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`chat-command-panel-toggle${targetMode === opt.value ? " chat-command-panel-toggle-active" : ""}`}
                onClick={() => setTargetMode(opt.value)}
                disabled={busy}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>

        {targetMode === "baseBranch" && (
          <label className="chat-command-panel-field">
            <span className="chat-command-panel-field-label">
              {t("reviewPicker.branchLabel")}
            </span>
            <input
              className="chat-command-panel-input"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              placeholder={t("reviewPicker.branchPlaceholder")}
              disabled={busy}
              autoFocus
            />
          </label>
        )}

        {targetMode === "commit" && (
          <label className="chat-command-panel-field">
            <span className="chat-command-panel-field-label">
              {t("reviewPicker.commitLabel")}
            </span>
            <input
              className="chat-command-panel-input"
              value={commitSha}
              onChange={(e) => setCommitSha(e.target.value)}
              placeholder={t("reviewPicker.commitPlaceholder")}
              disabled={busy}
              autoFocus
            />
          </label>
        )}

        {targetMode === "custom" && (
          <label className="chat-command-panel-field">
            <span className="chat-command-panel-field-label">
              {t("reviewPicker.instructionsLabel")}
            </span>
            <textarea
              className="chat-command-panel-input"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={t("reviewPicker.instructionsPlaceholder")}
              rows={3}
              disabled={busy}
              spellCheck={false}
              style={{ resize: "vertical" }}
              autoFocus
            />
          </label>
        )}

        <label className="chat-command-panel-field">
          <span className="chat-command-panel-field-label">
            {t("reviewPicker.deliveryLabel")}
          </span>
          <div className="chat-command-panel-toggle-group">
            <button
              type="button"
              className={`chat-command-panel-toggle${delivery === "inline" ? " chat-command-panel-toggle-active" : ""}`}
              onClick={() => setDelivery("inline")}
              disabled={busy}
            >
              {t("reviewPicker.delivery.inline")}
            </button>
            <button
              type="button"
              className={`chat-command-panel-toggle${delivery === "detached" ? " chat-command-panel-toggle-active" : ""}`}
              onClick={() => setDelivery("detached")}
              disabled={busy}
            >
              {t("reviewPicker.delivery.detached")}
            </button>
          </div>
        </label>

        <div className="chat-command-panel-hint">
          {delivery === "detached"
            ? t("reviewPicker.deliveryDescriptions.detached")
            : t("reviewPicker.deliveryDescriptions.inline")}
        </div>
      </div>

      {displayError && (
        <div className="chat-command-panel-error">{displayError}</div>
      )}
      <div className="chat-command-panel-actions">
        <button
          type="button"
          className="chat-command-panel-btn-secondary"
          onClick={onDismiss}
          disabled={busy}
        >
          {t("panel.approvalActions.cancel")}
        </button>
        <button
          type="button"
          className="chat-command-panel-btn-primary"
          onClick={handleConfirm}
          disabled={busy}
        >
          <Search size={11} />
          {busy ? t("reviewPicker.working") : t("reviewPicker.startAction")}
        </button>
      </div>
    </div>
  );
}

/* ── Info list panel (skills / mcp / experimental) ── */

function InfoListPanel({
  icon: Icon,
  title,
  emptyLabel,
  items,
  onDismiss,
}: {
  icon: typeof Scissors;
  title: string;
  emptyLabel: string;
  items: { name: string; detail?: string; enabled?: boolean; badge?: string }[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation("chat");
  return (
    <div className="chat-command-panel">
      <div className="chat-command-panel-header">
        <div className="chat-command-panel-title">
          <Icon size={12} />
          <span>{title}</span>
        </div>
        <button
          type="button"
          className="chat-command-panel-close"
          onClick={onDismiss}
        >
          <X size={12} />
        </button>
      </div>
      {items.length === 0 ? (
        <div className="chat-command-panel-desc">{emptyLabel}</div>
      ) : (
        <div className="chat-command-panel-info-list">
          {items.map((item) => (
            <div key={item.name} className="chat-command-panel-info-item">
              <span className="chat-command-panel-info-name">
                {item.name}
              </span>
              {item.detail && (
                <span className="chat-command-panel-info-detail">
                  {item.detail}
                </span>
              )}
              {item.enabled !== undefined && (
                <span
                  className={`chat-command-panel-info-badge ${item.enabled ? "chat-command-panel-info-badge-on" : "chat-command-panel-info-badge-off"}`}
                >
                  {item.enabled ? t("slashCommands.panels.info.badgeOn") : t("slashCommands.panels.info.badgeOff")}
                </span>
              )}
              {item.badge && (
                <span className="chat-command-panel-info-badge">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
