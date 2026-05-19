import { memo } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getHarnessIcon } from "../shared/HarnessLogos";
import type { EngineHealth, EngineInfo, EngineModel } from "../../types";
import { reasoningOptionsForModel } from "./reasoningEffort";

interface EngineSelectorProps {
  engines: EngineInfo[];
  health: Record<string, EngineHealth>;
  selectedEngineId: string;
  selectedModelId: string | null;
  selectedEffort: string;
  onEngineModelChange: (engineId: string, modelId: string) => void;
  onEffortChange: (effort: string) => void;
  disabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

// Inline copy of formatModelName from ModelPicker to avoid circular import
const MODEL_TOKEN_LABELS: Record<string, string> = {
  gpt: "GPT",
  codex: "Codex",
  opencode: "OpenCode",
  claude: "Claude",
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
  mini: "Mini",
};

function formatModelName(name: string): string {
  const slashParts = name
    .split("/")
    .filter(Boolean)
    .map((part) => part.trim())
    .filter(Boolean);
  const displayParts =
    slashParts.length > 2 && slashParts[0]?.toLowerCase() === "openrouter"
      ? slashParts.slice(2)
      : slashParts.length > 1
        ? slashParts.slice(1)
        : slashParts;
  const source = displayParts.length > 0 ? displayParts : [name];
  return source
    .map((part) =>
      part
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((segment) => {
          const lower = segment.toLowerCase();
          if (MODEL_TOKEN_LABELS[lower]) return MODEL_TOKEN_LABELS[lower];
          if (/^\d+(\.\d+)*$/.test(segment)) return segment;
          if (/^[a-z]?\d+(\.\d+)*$/i.test(segment)) return segment.toUpperCase();
          return segment.charAt(0).toUpperCase() + segment.slice(1);
        })
        .join(" "),
    )
    .join(" / ");
}

function shortEffortLabel(t: (key: string, options?: Record<string, unknown>) => string, effort: string): string {
  switch (effort) {
    case "none": return t("modelPicker.effort.noneShort");
    case "minimal": return t("modelPicker.effort.minimalShort");
    case "low": return t("modelPicker.effort.lowShort");
    case "medium": return t("modelPicker.effort.mediumShort");
    case "high": return t("modelPicker.effort.highShort");
    case "xhigh": return t("modelPicker.effort.xhighShort");
    case "max": return t("modelPicker.effort.maxShort");
    default: return effort.charAt(0).toUpperCase() + effort.slice(1);
  }
}

export const EngineSelector = memo(function EngineSelector({
  engines,
  selectedEngineId,
  selectedModelId,
  selectedEffort,
  disabled = false,
  isOpen,
  onToggle,
}: EngineSelectorProps) {
  const { t } = useTranslation("chat");

  // Resolve current selection for trigger label
  const currentEngine = engines.find((e) => e.id === selectedEngineId) ?? engines[0];
  const currentModel =
    currentEngine?.models.find((m) => m.id === selectedModelId) ??
    currentEngine?.models.find((m) => !m.hidden) ??
    null;

  // Build trigger label
  const triggerLabel = currentModel
    ? formatModelName(currentModel.displayName)
    : currentEngine?.name ?? t("modelPicker.selectModel");

  const reasoningOptions = reasoningOptionsForModel(currentModel, currentEngine?.id);

  return (
    <button
      type="button"
      className={`mp-trigger${isOpen ? " mp-trigger-open" : ""}`}
      onClick={onToggle}
      disabled={disabled}
      title={t("modelPicker.selectModel")}
    >
      <span className="mp-trigger-icon">
        {getHarnessIcon(selectedEngineId, 12)}
      </span>
      <span className="mp-trigger-label">{triggerLabel}</span>
      {selectedEffort && reasoningOptions.length > 0 ? (
        <span className="mp-trigger-effort">{shortEffortLabel(t, selectedEffort)}</span>
      ) : null}
      <ChevronDown size={10} className={`mp-trigger-chevron${isOpen ? " mp-trigger-chevron-open" : ""}`} />
    </button>
  );
});