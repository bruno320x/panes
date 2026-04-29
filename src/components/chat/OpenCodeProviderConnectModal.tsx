import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ipc } from "../../lib/ipc";
import { useEngineStore } from "../../stores/engineStore";
import { useTerminalStore } from "../../stores/terminalStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import type { EngineModel } from "../../types";

interface Props {
  open: boolean;
  models: EngineModel[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

interface ProviderGroup {
  providerId: string;
  providerLabel: string;
  models: EngineModel[];
}

function providerIdFor(modelId: string): string {
  const parts = modelId.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return "local";
  if (parts[0]?.toLowerCase() === "openrouter" && parts.length > 2) return parts[1].toLowerCase();
  return parts[0].toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function groupProviders(models: EngineModel[]): ProviderGroup[] {
  const groups = new Map<string, ProviderGroup>();
  for (const model of models) {
    const providerId = providerIdFor(model.id);
    const group = groups.get(providerId) ?? {
      providerId,
      providerLabel: titleCase(providerId),
      models: [],
    };
    group.models.push(model);
    groups.set(providerId, group);
  }
  return Array.from(groups.values()).sort((a, b) => a.providerLabel.localeCompare(b.providerLabel));
}

export function OpenCodeProviderConnectModal({ open, models, onClose, onRefresh }: Props) {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const setTerminalLayoutMode = useTerminalStore((state) => state.setLayoutMode);
  const reloadEngines = useEngineStore((state) => state.load);
  const ensureEngineHealth = useEngineStore((state) => state.ensureHealth);
  const [query, setQuery] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const providers = useMemo(() => groupProviders(models), [models]);
  const filteredProviders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((provider) => {
      const providerText = `${provider.providerId} ${provider.providerLabel}`.toLowerCase();
      const modelText = provider.models.map((model) => `${model.id} ${model.displayName}`).join(" ").toLowerCase();
      return providerText.includes(q) || modelText.includes(q);
    });
  }, [providers, query]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const selectedProvider =
    filteredProviders.find((provider) => provider.providerId === selectedProviderId) ?? filteredProviders[0] ?? null;
  const visibleModels = selectedProvider
    ? selectedProvider.models.filter((model) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return `${model.id} ${model.displayName}`.toLowerCase().includes(q)
          || selectedProvider.providerLabel.toLowerCase().includes(q);
      })
    : [];

  if (!open) return null;

  async function refreshOpenCode() {
    await reloadEngines();
    await ensureEngineHealth("opencode", { force: true });
    await onRefresh();
  }

  async function openConnect() {
    if (!activeWorkspaceId || !activeWorkspace) {
      setStatus("Open a workspace before connecting OpenCode providers.");
      return;
    }
    setStatus("Opening OpenCode /connect in the terminal...");
    try {
      await setTerminalLayoutMode(activeWorkspaceId, "split");
      const session = await ipc.terminalCreateSession(activeWorkspaceId, 120, 36, activeWorkspace.rootPath);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      await ipc.terminalWrite(activeWorkspaceId, session.id, "opencode\r");
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      await ipc.terminalWrite(activeWorkspaceId, session.id, "/connect\r");
      setStatus("Complete setup in OpenCode, then reopen the picker if models do not refresh automatically.");
      window.setTimeout(() => {
        void refreshOpenCode();
      }, 4000);
    } catch (error) {
      setStatus(`Failed to open OpenCode /connect: ${String(error)}`);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.56)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} role="dialog" aria-modal="true">
      <div style={{ width: "min(920px, calc(100vw - 48px))", maxHeight: "min(720px, calc(100vh - 48px))", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>Connect OpenCode provider</div>
            <div style={{ color: "var(--text-3)", fontSize: 12 }}>Typeahead search for providers and models.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ cursor: "pointer", color: "var(--text-2)" }}><X size={16} /></button>
        </div>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-1)" }}>
            <Search size={14} style={{ color: "var(--text-3)" }} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search providers or models..." autoFocus style={{ flex: 1, minWidth: 0 }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: 0, flex: 1 }}>
          <div style={{ borderRight: "1px solid var(--border)", padding: 12, overflow: "auto" }}>
            <button type="button" onClick={() => setSelectedProviderId("custom")} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer" }}>
              <div style={{ fontWeight: 600 }}>Custom</div>
              <div style={{ color: "var(--text-3)", fontSize: 11 }}>Use OpenCode /connect, then edit opencode.json if needed.</div>
            </button>
            <div style={{ height: 8 }} />
            {filteredProviders.map((provider) => (
              <button key={provider.providerId} type="button" onClick={() => setSelectedProviderId(provider.providerId)} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: provider.providerId === selectedProvider?.providerId && selectedProviderId !== "custom" ? "rgba(255,255,255,0.06)" : "transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{provider.providerLabel}</span>
                  <span style={{ color: "var(--text-3)", fontSize: 11 }}>{provider.models.length}</span>
                </div>
                <div style={{ color: "var(--text-3)", fontSize: 11 }}>{provider.providerId}</div>
              </button>
            ))}
          </div>
          <div style={{ padding: 16, overflow: "auto" }}>
            {selectedProviderId === "custom" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 600 }}>Custom provider</div>
                <div style={{ color: "var(--text-2)" }}>OpenCode handles the interactive provider setup. Custom endpoint editing will be handled in a follow-up without exposing advanced settings in the main picker.</div>
                <button type="button" className="btn btn-primary" onClick={openConnect}>Open /connect</button>
              </div>
            ) : selectedProvider ? (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedProvider.providerLabel}</div>
                    <div style={{ color: "var(--text-3)", fontSize: 12 }}>{selectedProvider.models.length} known models</div>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={openConnect}>Open /connect</button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {visibleModels.slice(0, 80).map((model) => (
                    <div key={model.id} style={{ padding: 9, border: "1px solid var(--border)", borderRadius: 8 }}>
                      <div style={{ fontWeight: 600 }}>{model.displayName}</div>
                      <div style={{ color: "var(--text-3)", fontSize: 11 }}>{model.id}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div style={{ color: "var(--text-3)" }}>No providers matched.</div>}
          </div>
        </div>
        {status ? <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12 }}>{status}</div> : null}
      </div>
    </div>
  );
}
