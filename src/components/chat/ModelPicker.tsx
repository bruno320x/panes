import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useEngineStore } from "../../stores/engineStore";
import { getHarnessIcon } from "../shared/HarnessLogos";
import type { EngineHealth, EngineInfo, EngineModel } from "../../types";
import { OpenCodeProviderConnectModal } from "./OpenCodeProviderConnectModal";

interface ModelPickerProps {
  engines: EngineInfo[];
  health: Record<string, EngineHealth>;
  selectedEngineId: string;
  selectedModelId: string | null;
  selectedEffort: string;
  onEngineModelChange: (engineId: string, modelId: string) => void;
  onEffortChange: (effort: string) => void;
  disabled?: boolean;
}

export interface OpenCodeProviderModelGroup {
  providerId: string;
  providerLabel: string;
  activeModels: EngineModel[];
  legacyModels: EngineModel[];
  totalModelCount: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  azure: "Azure",
  bedrock: "Bedrock",
  github: "GitHub",
  google: "Google",
  groq: "Groq",
  local: "Local",
  mistral: "Mistral",
  ollama: "Ollama",
  openai: "OpenAI",
  opencode: "OpenCode",
  openrouter: "OpenRouter",
  vertex: "Vertex",
};

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

export function getOpenCodeProviderId(modelId: string): string {
  const parts = modelId
    .trim()
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return "local";
  if (parts[0]?.toLowerCase() === "openrouter" && parts.length > 2) return parts[1].toLowerCase();
  return parts[0].toLowerCase();
}

export function formatOpenCodeProviderName(providerId: string): string {
  const normalized = providerId.trim().toLowerCase();
  if (PROVIDER_LABELS[normalized]) return PROVIDER_LABELS[normalized];
  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => PROVIDER_LABELS[part] ?? formatModelName(part))
    .join(" ");
}

export function groupOpenCodeModels(models: EngineModel[]): OpenCodeProviderModelGroup[] {
  const groups = new Map<string, OpenCodeProviderModelGroup>();
  for (const model of models) {
    const providerId = getOpenCodeProviderId(model.id);
    let group = groups.get(providerId);
    if (!group) {
      group = {
        providerId,
        providerLabel: formatOpenCodeProviderName(providerId),
        activeModels: [],
        legacyModels: [],
        totalModelCount: 0,
      };
      groups.set(providerId, group);
    }
    group.totalModelCount += 1;
    if (model.hidden) group.legacyModels.push(model);
    else group.activeModels.push(model);
  }
  return Array.from(groups.values()).sort((a, b) => a.providerLabel.localeCompare(b.providerLabel));
}

export function filterOpenCodeModelsForQuery(models: EngineModel[], query: string): EngineModel[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return models;
  return models.filter((model) =>
    [model.id, model.displayName, model.description, formatModelName(model.displayName)]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

export function formatCompactTokenLimit(tokens?: number | null): string | null {
  if (typeof tokens !== "number" || !Number.isFinite(tokens) || tokens <= 0) return null;
  if (tokens >= 1_000_000) {
    const value = tokens / 1_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}M`;
  }
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return tokens.toString();
}

interface ModelMetadataChip {
  label: string;
  title?: string;
}

export function modelMetadataChips(
  t: TFunction<"chat">,
  model: EngineModel,
  engineId?: string,
): ModelMetadataChip[] {
  const chips: ModelMetadataChip[] = [];
  const attachmentModalities = new Set((model.attachmentModalities ?? []).map((modality) => modality.toLowerCase()));
  const attachmentMetadataMissing = (model.attachmentModalities ?? []).length === 0;
  if (attachmentModalities.has("image")) chips.push({ label: t("modelPicker.metadata.vision") });
  if (attachmentModalities.has("pdf")) chips.push({ label: t("modelPicker.metadata.pdf") });
  if (attachmentModalities.has("text")) {
    chips.push({ label: t("modelPicker.metadata.files") });
  } else if (attachmentMetadataMissing && engineId === "opencode") {
    chips.push({
      label: t("modelPicker.metadata.files"),
      title: "OpenCode did not report attachment metadata for this model; file support is handled by the OpenCode runtime.",
    });
  } else if (attachmentMetadataMissing) {
    chips.push({ label: t("modelPicker.metadata.noFiles") });
  }
  const contextLimit = formatCompactTokenLimit(model.limits?.contextTokens);
  const inputLimit = formatCompactTokenLimit(model.limits?.inputTokens);
  const outputLimit = formatCompactTokenLimit(model.limits?.outputTokens);
  if (contextLimit) chips.push({ label: t("modelPicker.metadata.contextLimit", { tokens: contextLimit }) });
  else if (inputLimit) chips.push({ label: t("modelPicker.metadata.inputLimit", { tokens: inputLimit }) });
  if (outputLimit) chips.push({ label: t("modelPicker.metadata.outputLimit", { tokens: outputLimit }) });
  return chips;
}

function shouldShowModelDescription(engineId: string, model: EngineModel): boolean {
  return Boolean(model.description) && !(engineId === "opencode" && model.description.trim() === "OpenCode model");
}

function shortEffortLabel(t: TFunction<"chat">, effort: string): string {
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

function effortDisplayLabel(t: TFunction<"chat">, effort: string): string {
  switch (effort) {
    case "none": return t("modelPicker.effort.none");
    case "minimal": return t("modelPicker.effort.minimal");
    case "low": return t("modelPicker.effort.low");
    case "medium": return t("modelPicker.effort.medium");
    case "high": return t("modelPicker.effort.high");
    case "xhigh": return t("modelPicker.effort.xhigh");
    case "max": return t("modelPicker.effort.max");
    default: return effort.charAt(0).toUpperCase() + effort.slice(1);
  }
}

export function ModelPicker({
  engines,
  health,
  selectedEngineId,
  selectedModelId,
  selectedEffort,
  onEngineModelChange,
  onEffortChange,
  disabled = false,
}: ModelPickerProps) {
  const { t } = useTranslation("chat");
  const [open, setOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [activeEngineId, setActiveEngineId] = useState(selectedEngineId);
  const [activeOpenCodeProviderId, setActiveOpenCodeProviderId] = useState<string | null>(null);
  const [openCodeModelQuery, setOpenCodeModelQuery] = useState("");
  const [legacyExpanded, setLegacyExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const ensureEngineHealth = useEngineStore((state) => state.ensureHealth);
  const reloadEngines = useEngineStore((state) => state.load);

  useEffect(() => setActiveEngineId(selectedEngineId), [selectedEngineId]);
  useEffect(() => setLegacyExpanded(false), [activeEngineId]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    for (const engine of engines) {
      const engineHealth = health[engine.id];
      if (!engineHealth) void ensureEngineHealth(engine.id);
      else if (engineHealth.available === false) void ensureEngineHealth(engine.id, { force: true });
    }
  }, [engines, ensureEngineHealth, health, open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = activeEngineId === "opencode" ? 680 : 440;
    setPos({ bottom: window.innerHeight - rect.top + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8)) });
  }, [activeEngineId, open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const toggle = useCallback(() => {
    if (!disabled) setOpen((prev) => !prev);
  }, [disabled]);

  const currentEngine = engines.find((engine) => engine.id === selectedEngineId) ?? engines[0];
  const currentModel =
    currentEngine?.models.find((model) => model.id === selectedModelId) ??
    currentEngine?.models.find((model) => !model.hidden) ??
    null;
  const browsingEngine = engines.find((engine) => engine.id === activeEngineId) ?? engines[0];
  const browsingModels = browsingEngine?.models ?? [];
  const activeModels = browsingModels.filter((model) => !model.hidden);
  const legacyModels = browsingModels.filter((model) => model.hidden);
  const openCodeProviderGroups = useMemo(() => groupOpenCodeModels(browsingModels), [browsingModels]);
  const selectedOpenCodeProviderId = selectedEngineId === "opencode" && selectedModelId ? getOpenCodeProviderId(selectedModelId) : null;
  const activeOpenCodeProvider =
    openCodeProviderGroups.find((group) => group.providerId === activeOpenCodeProviderId) ??
    openCodeProviderGroups.find((group) => group.providerId === selectedOpenCodeProviderId) ??
    openCodeProviderGroups[0] ??
    null;

  useEffect(() => {
    if (activeEngineId !== "opencode") {
      setActiveOpenCodeProviderId(null);
      setOpenCodeModelQuery("");
      return;
    }
    setActiveOpenCodeProviderId((current) =>
      current && openCodeProviderGroups.some((group) => group.providerId === current)
        ? current
        : selectedOpenCodeProviderId ?? openCodeProviderGroups[0]?.providerId ?? null,
    );
  }, [activeEngineId, openCodeProviderGroups, selectedOpenCodeProviderId]);

  async function refreshOpenCodeCatalog() {
    await reloadEngines();
    await ensureEngineHealth("opencode", { force: true });
    setActiveEngineId("opencode");
    setOpenCodeModelQuery("");
    setLegacyExpanded(false);
  }

  function handleModelSelect(engineId: string, modelId: string) {
    onEngineModelChange(engineId, modelId);
  }

  function renderFlatModelList() {
    return (
      <div className="mp-models-list">
        {activeModels.map((model) => (
          <ModelRow key={model.id} model={model} engineId={activeEngineId} isSelected={selectedEngineId === activeEngineId && model.id === (selectedModelId ?? currentModel?.id)} selectedEffort={selectedEffort} onSelect={handleModelSelect} onEffortChange={onEffortChange} />
        ))}
        {legacyModels.length > 0 && (
          <>
            <button type="button" className="mp-legacy-toggle" onClick={() => setLegacyExpanded((prev) => !prev)}>
              <span className="mp-legacy-toggle-label">{t("modelPicker.legacy", { count: legacyModels.length })}</span>
              <ChevronRight size={11} className={`mp-legacy-chevron${legacyExpanded ? " mp-legacy-chevron-open" : ""}`} />
            </button>
            {legacyExpanded && legacyModels.map((model) => (
              <ModelRow key={model.id} model={model} engineId={activeEngineId} isSelected={selectedEngineId === activeEngineId && model.id === (selectedModelId ?? currentModel?.id)} selectedEffort={selectedEffort} onSelect={handleModelSelect} onEffortChange={onEffortChange} />
            ))}
          </>
        )}
      </div>
    );
  }

  function renderOpenCodeProviderTree() {
    const provider = activeOpenCodeProvider;
    const providerActiveModels = provider ? filterOpenCodeModelsForQuery(provider.activeModels, openCodeModelQuery) : [];
    const providerLegacyModels = provider ? filterOpenCodeModelsForQuery(provider.legacyModels, openCodeModelQuery) : [];
    const providerVisibleCount = providerActiveModels.length + providerLegacyModels.length;
    return (
      <div className="mp-provider-tree">
        <div className="mp-provider-list">
          <div className="mp-provider-list-heading">
            <span>{t("modelPicker.providers")}</span>
            <button type="button" className="mp-add-provider-btn" onClick={() => setConnectOpen(true)} title={t("modelPicker.addProvider")}>
              <Plus size={12} />
            </button>
          </div>
          {openCodeProviderGroups.map((group) => {
            const isActive = group.providerId === provider?.providerId;
            const isSelected = group.providerId === selectedOpenCodeProviderId;
            return (
              <button key={group.providerId} type="button" className={`mp-provider-row${isActive ? " mp-provider-row-active" : ""}${isSelected ? " mp-provider-row-selected" : ""}`} onClick={() => { setLegacyExpanded(false); setActiveOpenCodeProviderId(group.providerId); }}>
                <span className="mp-provider-name">{group.providerLabel}</span>
                <span className="mp-provider-count">{group.totalModelCount}</span>
                <ChevronRight size={12} className="mp-provider-chevron" />
              </button>
            );
          })}
        </div>
        <div className="mp-provider-models">
          <div className="mp-model-search">
            <Search size={12} className="mp-model-search-icon" />
            <input className="mp-model-search-input" value={openCodeModelQuery} onChange={(event) => setOpenCodeModelQuery(event.target.value)} placeholder={t("modelPicker.searchModels")} aria-label={t("modelPicker.searchModels")} />
            {provider ? <span className="mp-model-search-count">{openCodeModelQuery.trim() ? `${providerVisibleCount}/${provider.totalModelCount}` : provider.totalModelCount}</span> : null}
          </div>
          <div className="mp-models-list mp-models-list-provider">
            {providerActiveModels.map((model) => (
              <ModelRow key={model.id} model={model} engineId={activeEngineId} isSelected={selectedEngineId === activeEngineId && model.id === (selectedModelId ?? currentModel?.id)} selectedEffort={selectedEffort} onSelect={handleModelSelect} onEffortChange={onEffortChange} />
            ))}
            {provider && providerLegacyModels.length > 0 && (
              <>
                <button type="button" className="mp-legacy-toggle" onClick={() => setLegacyExpanded((prev) => !prev)}>
                  <span className="mp-legacy-toggle-label">{t("modelPicker.legacy", { count: providerLegacyModels.length })}</span>
                  <ChevronRight size={11} className={`mp-legacy-chevron${legacyExpanded ? " mp-legacy-chevron-open" : ""}`} />
                </button>
                {legacyExpanded && providerLegacyModels.map((model) => (
                  <ModelRow key={model.id} model={model} engineId={activeEngineId} isSelected={selectedEngineId === activeEngineId && model.id === (selectedModelId ?? currentModel?.id)} selectedEffort={selectedEffort} onSelect={handleModelSelect} onEffortChange={onEffortChange} />
                ))}
              </>
            )}
            {provider && providerVisibleCount === 0 ? <div className="mp-empty">{t("modelPicker.noModels")}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  const triggerLabel = currentModel ? formatModelName(currentModel.displayName) : currentEngine?.name ?? t("modelPicker.selectModel");
  const trigger = (
    <button ref={triggerRef} type="button" className={`mp-trigger${open ? " mp-trigger-open" : ""}`} onClick={toggle} disabled={disabled} title={t("modelPicker.selectModel")}>
      <span className="mp-trigger-icon">{getHarnessIcon(selectedEngineId, 12)}</span>
      <span className="mp-trigger-label">{triggerLabel}</span>
      {selectedEffort && currentModel?.supportedReasoningEfforts?.length ? <span className="mp-trigger-effort">{shortEffortLabel(t, selectedEffort)}</span> : null}
      <ChevronDown size={10} className={`mp-trigger-chevron${open ? " mp-trigger-chevron-open" : ""}`} />
    </button>
  );

  const popover = open
    ? createPortal(
        <div ref={popoverRef} className={`mp-popover${browsingEngine?.id === "opencode" ? " mp-popover-opencode" : ""}`} style={{ position: "fixed", bottom: pos.bottom, left: pos.left }}>
          <div className="mp-rail">
            <div className="mp-rail-label">{t("modelPicker.engine")}</div>
            {engines.map((engine) => {
              const isActive = engine.id === activeEngineId;
              const available = health[engine.id]?.available !== false;
              return (
                <button key={engine.id} type="button" className={`mp-rail-engine${isActive ? " mp-rail-engine-active" : ""}`} onClick={() => setActiveEngineId(engine.id)}>
                  <span className="mp-rail-engine-icon">{getHarnessIcon(engine.id, 15)}</span>
                  <span className="mp-rail-engine-name">{engine.name}</span>
                  <span className={`mp-rail-dot${available ? " mp-rail-dot-ok" : " mp-rail-dot-err"}`} />
                </button>
              );
            })}
          </div>
          <div className="mp-models">
            {browsingEngine?.id !== "opencode" ? (
              <div className="mp-models-header">
                <span className="mp-models-title">{t("modelPicker.models")}</span>
                <span className="mp-models-count">{activeModels.length}</span>
              </div>
            ) : null}
            {browsingEngine?.id === "opencode" ? renderOpenCodeProviderTree() : renderFlatModelList()}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="mp-root">
      {trigger}
      {popover}
      <OpenCodeProviderConnectModal open={connectOpen} models={browsingModels} onClose={() => setConnectOpen(false)} onRefresh={refreshOpenCodeCatalog} />
    </div>
  );
}

function ModelRow({
  model,
  engineId,
  isSelected,
  selectedEffort,
  onSelect,
  onEffortChange,
}: {
  model: EngineModel;
  engineId: string;
  isSelected: boolean;
  selectedEffort: string;
  onSelect: (engineId: string, modelId: string) => void;
  onEffortChange: (effort: string) => void;
}) {
  const { t } = useTranslation("chat");
  const efforts = model.supportedReasoningEfforts ?? [];
  const metadataChips = modelMetadataChips(t, model, engineId);
  const showDescription = shouldShowModelDescription(engineId, model);
  const modelClassName = ["mp-model", isSelected ? "mp-model-selected" : ""].filter(Boolean).join(" ");
  return (
    <div className={modelClassName}>
      <button type="button" className="mp-model-btn" onClick={() => onSelect(engineId, model.id)}>
        <div className="mp-model-info">
          <div className="mp-model-name-row">
            <span className="mp-model-name">{formatModelName(model.displayName)}</span>
            {model.isDefault && <span className="mp-model-default">{t("modelPicker.default")}</span>}
          </div>
          {showDescription && <span className="mp-model-desc">{model.description}</span>}
          {isSelected && metadataChips.length > 0 ? (
            <span className="mp-model-meta">
              {metadataChips.map((chip) => <span key={chip.label} className="mp-model-meta-chip" title={chip.title}>{chip.label}</span>)}
            </span>
          ) : null}
        </div>
        {isSelected && <Check size={13} className="mp-model-check" />}
      </button>
      {isSelected && efforts.length > 0 && (
        <div className="mp-model-controls">
          <span className="mp-model-controls-label">{t("modelPicker.thinking")}</span>
          <div className="mp-model-option-pills">
            {efforts.map((opt) => {
              const active = opt.reasoningEffort === selectedEffort;
              return (
                <button key={opt.reasoningEffort} type="button" className={`mp-model-option-pill${active ? " mp-model-option-pill-active" : ""}`} onClick={() => onEffortChange(opt.reasoningEffort)} title={opt.description}>
                  {effortDisplayLabel(t, opt.reasoningEffort)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
