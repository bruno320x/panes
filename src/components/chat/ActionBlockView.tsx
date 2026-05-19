import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Loader2,
  Terminal,
  CheckCircle2,
  XCircle,
  Circle,
  FileCode2,
  FileDiff,
} from "lucide-react";
import type { ActionBlock } from "../../types";
import { LinkifiedPlainText, handleToggleKeyDown } from "./MessageBlocks";

function ActionStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("chat");
  if (status === "done") {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--text-3)", fontSize: 10 }}>
        <CheckCircle2 size={11} />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--warning)", fontSize: 10, fontWeight: 500 }}>
        <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
        {t("messageBlocks.actionStatus.running")}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--danger)", fontSize: 10 }}>
        <XCircle size={11} />
        {t("messageBlocks.actionStatus.error")}
      </span>
    );
  }
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--text-3)", fontSize: 10 }}>
      <Circle size={11} />
    </span>
  );
}

const actionIcons: Record<string, typeof Terminal> = {
  command: Terminal,
  file_read: FileCode2,
  file_write: FileCode2,
  file_edit: FileDiff,
  file_delete: FileCode2,
  git: FileDiff,
  search: Terminal,
  other: Terminal,
};

export function ActionBlockView({
  block,
  onLoadDeferredOutput,
}: {
  block: ActionBlock;
  onLoadDeferredOutput?: () => Promise<void>;
}) {
  const { t } = useTranslation("chat");
  const outputChunks = Array.isArray(block.outputChunks) ? block.outputChunks : [];
  const outputDeferred = block.outputDeferred === true;
  const outputText = useMemo(
    () => {
      let raw: string;
      if (outputChunks.length === 0) {
        return "";
      }
      if (outputChunks.length === 1) {
        const firstContent = outputChunks[0].content;
        raw = typeof firstContent === "string" ? firstContent : String(firstContent ?? "");
      } else {
        raw = outputChunks.map((chunk) => String(chunk.content ?? "")).join("");
      }
      if (raw.includes("\\n") || raw.includes("\\t")) {
        raw = raw.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      }
      return raw;
    },
    [outputChunks],
  );
  const Icon = actionIcons[block.actionType] ?? Terminal;
  const isRunning = block.status === "running";
  const isPending = block.status === "pending";
  const hasBody = outputChunks.length > 0 || Boolean(block.result?.error) || outputDeferred;
  const actionDetails = (block.details ?? {}) as Record<string, unknown>;
  const outputTruncated =
    "outputTruncated" in actionDetails && actionDetails.outputTruncated === true;
  const progressMessage =
    actionDetails.progressKind === "mcp" && typeof actionDetails.progressMessage === "string"
      ? actionDetails.progressMessage
      : null;
  const [expanded, setExpanded] = useState(false);
  const [loadingDeferredOutput, setLoadingDeferredOutput] = useState(false);
  const [deferredOutputError, setDeferredOutputError] = useState<string | null>(null);
  const deferredOutputRequestedRef = useRef(false);
  const canToggle = hasBody;

  const requestDeferredOutput = useCallback(() => {
    if (!onLoadDeferredOutput || deferredOutputRequestedRef.current) {
      return;
    }

    deferredOutputRequestedRef.current = true;
    setLoadingDeferredOutput(true);
    setDeferredOutputError(null);
    onLoadDeferredOutput()
      .catch((error) => {
        deferredOutputRequestedRef.current = false;
        setDeferredOutputError(String(error));
      })
      .finally(() => {
        setLoadingDeferredOutput(false);
      });
  }, [onLoadDeferredOutput]);

  useEffect(() => {
    if (!expanded || !outputDeferred || outputChunks.length > 0) {
      return;
    }
    requestDeferredOutput();
  }, [expanded, outputDeferred, outputChunks.length, requestDeferredOutput]);

  useEffect(() => {
    if (!outputDeferred || outputChunks.length > 0) {
      deferredOutputRequestedRef.current = false;
    }
  }, [outputDeferred, outputChunks.length]);

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);
  return (
    <div>
      <div
        className={canToggle ? "msg-block-header msg-block-header--compact" : undefined}
        style={canToggle ? undefined : { display: "flex", alignItems: "center", gap: 6, padding: "3px 12px" }}
        {...(canToggle ? {
          role: "button" as const,
          tabIndex: 0,
          "aria-expanded": expanded,
          onClick: toggleExpanded,
          onKeyDown: (e: React.KeyboardEvent) => handleToggleKeyDown(e, toggleExpanded),
        } : {})}
      >
        {canToggle && (
          <ChevronRight
            size={11}
            className={`msg-block-chevron${expanded ? " msg-block-chevron-open" : ""}`}
          />
        )}
        <Icon size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: "var(--text-2)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {block.summary}
        </span>
        <ActionStatusBadge status={block.status} />
        {block.result?.durationMs != null && block.status === "done" && (
          <span style={{ fontSize: 9.5, color: "var(--text-3)", flexShrink: 0 }}>
            {block.result.durationMs < 1000
              ? `${block.result.durationMs}ms`
              : `${(block.result.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      {progressMessage && (
        <div
          style={{
            padding: "0 12px 6px 30px",
            fontSize: 11,
            color: "var(--text-3)",
            lineHeight: 1.5,
          }}
        >
          {progressMessage}
        </div>
      )}

      {expanded && (outputChunks.length > 0 || block.result?.error || outputDeferred) && (
        <div style={{
          margin: "2px 12px 4px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}>
          {outputDeferred && outputChunks.length === 0 && (
            <div
              style={{
                margin: 0,
                padding: "8px 12px",
                background: "var(--code-bg)",
                fontSize: 11.5,
                lineHeight: 1.5,
                color: "var(--text-3)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                justifyContent: "space-between",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {loadingDeferredOutput && (
                  <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                )}
                {loadingDeferredOutput
                  ? t("messageBlocks.deferredOutput.loadingFull")
                  : deferredOutputError
                    ? t("messageBlocks.deferredOutput.failed")
                    : t("messageBlocks.deferredOutput.loading")}
              </span>
              {!loadingDeferredOutput && deferredOutputError && onLoadDeferredOutput && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deferredOutputRequestedRef.current = false;
                    requestDeferredOutput();
                  }}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-xs)",
                    padding: "3px 8px",
                    background: "var(--bg-2)",
                    color: "var(--text-2)",
                    fontSize: 10.5,
                    cursor: "pointer",
                  }}
                >
                  {t("messageBlocks.deferredOutput.retry")}
                </button>
              )}
            </div>
          )}

          {outputChunks.length > 0 && (
            <pre className="action-output-pre" style={{ maxHeight: 260 }}>
              <LinkifiedPlainText text={outputText} />
            </pre>
          )}

          {outputTruncated && (
            <div style={{
              margin: 0, padding: "5px 12px",
              borderTop: outputChunks.length > 0 ? "1px solid var(--border)" : undefined,
              background: "rgba(148, 163, 184, 0.06)",
              fontSize: 10.5, color: "var(--text-3)",
            }}>
              {t("messageBlocks.outputTruncated")}
            </div>
          )}

          {block.result?.error && (
            <pre
              className="action-output-error"
              style={{
                borderTop: outputChunks.length > 0 || outputTruncated
                  ? "1px solid rgba(248, 113, 113, 0.2)" : undefined,
              }}
            >
              <LinkifiedPlainText text={String(block.result.error)} />
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
