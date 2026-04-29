import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ipc } from "../../lib/ipc";
import { useEngineStore } from "../../stores/engineStore";
import { useTerminalStore } from "../../stores/terminalStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import type { EngineModel } from "../../types";
import {
  buildCustomProviderConfigPatch,
  buildProviderCatalog,
  isOpenCodeServerApiUnsupported,
  modelsEndpoint,
  normalizeProviderId,
  type ProviderGroup,
} from "./openCodeProviderConnectUtils";

interface Props {
  open: boolean;
  models: EngineModel[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

function authMethodLabel(base: string, label?: string): string {
  const trimmed = label?.trim();
  return trimmed && trimmed.toLowerCase() !== base.toLowerCase() ? trimmed : base;
}

export function OpenCodeProviderConnectModal({ open, models, onClose, onRefresh }: Props) {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const setTerminalLayoutMode = useTerminalStore((state) => state.setLayoutMode);
  const reloadEngines = useEngineStore((state) => state.load);
  const ensureEngineHealth = useEngineStore((state) => state.ensureHealth);
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [customProviderId, setCustomProviderId] = useState("");
  const [customProviderName, setCustomProviderName] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModels, setCustomModels] = useState<string[]>([]);
  const [selectedCustomModels, setSelectedCustomModels] = useState<string[]>([]);
  const [customModelDraft, setCustomModelDraft] = useState("");
  const [providerCatalog, setProviderCatalog] = useState<ProviderGroup[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providerApiUnsupported, setProviderApiUnsupported] = useState(false);
  const [pendingOauthProviderId, setPendingOauthProviderId] = useState<string | null>(null);
  const [pendingOauthMethodIndex, setPendingOauthMethodIndex] = useState<number | null>(null);
  const [oauthCode, setOauthCode] = useState("");

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  const filteredProviders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return providerCatalog;
    return providerCatalog.filter((provider) => {
      const providerText = `${provider.providerId} ${provider.providerLabel}`.toLowerCase();
      const modelText = provider.models.map((model) => `${model.id} ${model.displayName}`).join(" ").toLowerCase();
      return providerText.includes(q) || modelText.includes(q);
    });
  }, [providerCatalog, query]);

  const selectedProvider = selectedProviderId
    ? providerCatalog.find((provider) => provider.providerId === selectedProviderId) ?? filteredProviders[0] ?? providerCatalog[0] ?? null
    : filteredProviders[0] ?? providerCatalog[0] ?? null;

  const visibleModels = selectedProvider
    ? selectedProvider.models.filter((model) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return `${model.id} ${model.displayName}`.toLowerCase().includes(q)
          || selectedProvider.providerLabel.toLowerCase().includes(q);
      })
    : [];

  useEffect(() => {
    if (!open) return;
    setPendingOauthProviderId(null);
    setPendingOauthMethodIndex(null);
    setOauthCode("");
    void loadProviderState();
  }, [open, activeWorkspace?.rootPath, models]);

  useEffect(() => {
    if (selectedProviderId === "custom") return;
    if (!selectedProvider || selectedProvider.providerId !== pendingOauthProviderId) {
      setPendingOauthProviderId(null);
      setPendingOauthMethodIndex(null);
      setOauthCode("");
    }
  }, [selectedProviderId, selectedProvider, pendingOauthProviderId]);

  if (!open) return null;

  async function refreshOpenCode() {
    await reloadEngines();
    await ensureEngineHealth("opencode", { force: true });
    await onRefresh();
  }

  async function loadProviderState() {
    const fallbackCatalog = buildProviderCatalog(null, null, models);
    if (!activeWorkspace) {
      setProviderCatalog(fallbackCatalog);
      setProviderApiUnsupported(false);
      return;
    }

    setLoadingProviders(true);
    try {
      const [providersResult, authResult] = await Promise.allSettled([
        ipc.getOpenCodeProviders(activeWorkspace.rootPath),
        ipc.getOpenCodeProviderAuth(activeWorkspace.rootPath),
      ]);

      let providers = null;
      let auth = null;
      let unsupported = false;

      if (providersResult.status === "fulfilled") {
        providers = providersResult.value;
      } else if (isOpenCodeServerApiUnsupported(providersResult.reason)) {
        unsupported = true;
      } else {
        throw providersResult.reason;
      }

      if (authResult.status === "fulfilled") {
        auth = authResult.value;
      } else if (isOpenCodeServerApiUnsupported(authResult.reason)) {
        unsupported = true;
      } else {
        throw authResult.reason;
      }

      const catalog = buildProviderCatalog(providers, auth, models);
      setProviderApiUnsupported(unsupported);
      setProviderCatalog(catalog);
      setSelectedProviderId((current) => {
        if (current === "custom") return current;
        if (current && catalog.some((provider) => provider.providerId === current)) return current;
        return catalog[0]?.providerId ?? null;
      });
      if (unsupported) {
        setStatus("This OpenCode runtime does not expose the full provider API. Manual /connect remains available as a fallback.");
      }
    } catch (error) {
      setProviderApiUnsupported(false);
      setProviderCatalog(fallbackCatalog);
      setSelectedProviderId((current) => current === "custom" ? current : fallbackCatalog[0]?.providerId ?? null);
      setStatus(`Failed to load provider data from OpenCode: ${String(error)}`);
    } finally {
      setLoadingProviders(false);
    }
  }

  async function openConnect() {
    if (!activeWorkspaceId || !activeWorkspace) {
      setStatus("Open a workspace before connecting OpenCode providers.");
      return;
    }
    setStatus("Opening manual OpenCode /connect fallback in the terminal...");
    try {
      await setTerminalLayoutMode(activeWorkspaceId, "split");
      const session = await ipc.terminalCreateSession(activeWorkspaceId, 120, 36, activeWorkspace.rootPath);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      await ipc.terminalWrite(activeWorkspaceId, session.id, "opencode\r");
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      await ipc.terminalWrite(activeWorkspaceId, session.id, "/connect\r");
      setStatus("Complete setup in OpenCode, then return here to refresh providers.");
      window.setTimeout(() => {
        void refreshOpenCode();
        void loadProviderState();
      }, 4000);
    } catch (error) {
      setStatus(`Failed to open OpenCode /connect: ${String(error)}`);
    }
  }

  async function discoverModels() {
    const endpoint = modelsEndpoint(customBaseUrl);
    if (!endpoint) {
      setStatus("Enter the provider base URL first.");
      return;
    }
    setDiscovering(true);
    setStatus("Searching models at the custom endpoint...");
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const payload = await response.json() as { data?: Array<{ id?: string }> };
      const discovered = (payload.data ?? [])
        .map((item) => item.id)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .sort((a, b) => a.localeCompare(b));
      setCustomModels(discovered);
      setSelectedCustomModels(discovered.slice(0, 12));
      setStatus(discovered.length ? `Found ${discovered.length} models.` : "No model ids were found at that endpoint.");
    } catch (error) {
      setStatus(`Model discovery failed: ${String(error)}`);
    } finally {
      setDiscovering(false);
    }
  }

  function addManualModel() {
    const modelId = customModelDraft.trim();
    if (!modelId) return;
    setCustomModels((current) => Array.from(new Set([...current, modelId])).sort((a, b) => a.localeCompare(b)));
    setSelectedCustomModels((current) => Array.from(new Set([...current, modelId])));
    setCustomModelDraft("");
  }

  async function writeCustomProviderFallbackFile(providerId: string) {
    if (!activeWorkspace) {
      throw new Error("workspace is required");
    }

    let config: Record<string, unknown> = {};
    try {
      const existing = await ipc.readFile(activeWorkspace.rootPath, "opencode.json");
      config = JSON.parse(existing.content) as Record<string, unknown>;
    } catch {
      config = {};
    }

    const nextConfig = buildCustomProviderConfigPatch(config, {
      providerId,
      providerName: customProviderName,
      baseUrl: customBaseUrl,
      models: selectedCustomModels,
    });

    await ipc.writeFile(
      activeWorkspace.rootPath,
      "opencode.json",
      `${JSON.stringify(nextConfig, null, 2)}\n`,
      activeWorkspace.id,
    );
  }

  async function saveCustomProvider() {
    if (!activeWorkspace) {
      setStatus("Open a workspace before saving a custom provider.");
      return;
    }
    const providerId = normalizeProviderId(customProviderId);
    const baseUrl = customBaseUrl.trim().replace(/\/+$/, "");
    if (!providerId || !baseUrl || selectedCustomModels.length === 0) {
      setStatus("Provider id, base URL, and at least one model are required.");
      return;
    }

    setSaving(true);
    try {
      try {
        const existing = await ipc.getOpenCodeConfig(activeWorkspace.rootPath);
        const config =
          typeof existing === "object" && existing !== null && !Array.isArray(existing)
            ? existing
            : {};
        const patch = buildCustomProviderConfigPatch(config, {
          providerId,
          providerName: customProviderName,
          baseUrl,
          models: selectedCustomModels,
        });
        await ipc.patchOpenCodeConfig(activeWorkspace.rootPath, patch);
        setStatus("Custom provider saved through the OpenCode config API.");
      } catch (error) {
        if (!isOpenCodeServerApiUnsupported(error)) {
          throw error;
        }
        await writeCustomProviderFallbackFile(providerId);
        setStatus("This OpenCode runtime does not support config endpoints yet. Saved provider to project opencode.json as an explicit fallback.");
      }

      await refreshOpenCode();
      await loadProviderState();
      setSelectedProviderId(providerId);
    } catch (error) {
      setStatus(`Failed to save custom provider: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveApiKey() {
    if (!activeWorkspace || !selectedProvider) {
      setStatus("Open a workspace before saving provider credentials.");
      return;
    }

    const key = apiKeyInputRef.current?.value.trim() ?? "";
    if (!key) {
      setStatus("Enter an API key first.");
      return;
    }

    setSaving(true);
    try {
      await ipc.setOpenCodeProviderAuth(activeWorkspace.rootPath, selectedProvider.providerId, {
        type: "api",
        key,
      });
      if (apiKeyInputRef.current) {
        apiKeyInputRef.current.value = "";
      }
      setStatus(`Saved credentials for ${selectedProvider.providerLabel} through the OpenCode server API.`);
      await refreshOpenCode();
      await loadProviderState();
    } catch (error) {
      if (apiKeyInputRef.current) {
        apiKeyInputRef.current.value = "";
      }
      if (isOpenCodeServerApiUnsupported(error)) {
        setStatus("This OpenCode runtime does not support API-key auth endpoints yet. Use the manual /connect fallback.");
        setProviderApiUnsupported(true);
        return;
      }
      setStatus(`Failed to save provider credentials: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function startOauth(methodIndex: number) {
    if (!activeWorkspace || !selectedProvider) {
      setStatus("Open a workspace before starting provider OAuth.");
      return;
    }

    setSaving(true);
    try {
      const response = await ipc.startOpenCodeProviderOAuth(
        activeWorkspace.rootPath,
        selectedProvider.providerId,
        { method: methodIndex },
      ) as { url?: string; authorizationUrl?: string; method?: string; instructions?: string };
      const url = response.url ?? response.authorizationUrl;
      if (!url) {
        throw new Error("OpenCode did not return an authorization URL.");
      }
      window.open(url, "_blank", "noopener,noreferrer");
      if (response.method === "code") {
        setPendingOauthProviderId(selectedProvider.providerId);
        setPendingOauthMethodIndex(methodIndex);
        setStatus(response.instructions?.trim() || "Finish OAuth in the browser, then paste the returned code below.");
      } else {
        setPendingOauthProviderId(null);
        setPendingOauthMethodIndex(null);
        setOauthCode("");
        setStatus(response.instructions?.trim() || "Finish OAuth in the browser, then refresh if OpenCode does not reconnect automatically.");
        window.setTimeout(() => {
          void refreshOpenCode();
          void loadProviderState();
        }, 4000);
      }
    } catch (error) {
      if (isOpenCodeServerApiUnsupported(error)) {
        setStatus("This OpenCode runtime does not support OAuth provider endpoints yet. Use the manual /connect fallback.");
        setProviderApiUnsupported(true);
        return;
      }
      setStatus(`Failed to start provider OAuth: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function completeOauth() {
    if (!activeWorkspace || !selectedProvider || pendingOauthMethodIndex === null) {
      setStatus("Start OAuth before submitting a callback code.");
      return;
    }
    const code = oauthCode.trim();
    if (!code) {
      setStatus("Paste the OAuth code first.");
      return;
    }

    setSaving(true);
    try {
      await ipc.completeOpenCodeProviderOAuth(activeWorkspace.rootPath, selectedProvider.providerId, {
        method: pendingOauthMethodIndex,
        code,
      });
      setPendingOauthProviderId(null);
      setPendingOauthMethodIndex(null);
      setOauthCode("");
      setStatus(`OAuth completed for ${selectedProvider.providerLabel}.`);
      await refreshOpenCode();
      await loadProviderState();
    } catch (error) {
      if (isOpenCodeServerApiUnsupported(error)) {
        setStatus("This OpenCode runtime does not support OAuth callback endpoints yet. Use the manual /connect fallback.");
        setProviderApiUnsupported(true);
        return;
      }
      setStatus(`Failed to complete provider OAuth: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  function toggleCustomModel(modelId: string) {
    setSelectedCustomModels((current) =>
      current.includes(modelId)
        ? current.filter((value) => value !== modelId)
        : [...current, modelId],
    );
  }

  const apiAuthMethods = selectedProvider
    ? selectedProvider.authMethods.filter((method) => method.type === "api")
    : [];
  const oauthMethods = selectedProvider
    ? selectedProvider.authMethods.filter((method) => method.type === "oauth")
    : [];
  const waitingForOauthCode =
    selectedProvider?.providerId === pendingOauthProviderId && pendingOauthMethodIndex !== null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.56)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} role="dialog" aria-modal="true">
      <div style={{ width: "min(920px, calc(100vw - 48px))", maxHeight: "min(760px, calc(100vh - 48px))", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>Connect OpenCode provider</div>
            <div style={{ color: "var(--text-3)", fontSize: 12 }}>Providers and auth methods are loaded from the OpenCode server when available.</div>
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
            <button type="button" onClick={() => setSelectedProviderId("custom")} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", background: selectedProviderId === "custom" ? "var(--accent-dim)" : "transparent" }}>
              <div style={{ fontWeight: 600 }}>Custom</div>
              <div style={{ color: "var(--text-3)", fontSize: 11 }}>OpenAI-compatible endpoint</div>
            </button>
            <div style={{ height: 8 }} />
            {filteredProviders.map((provider) => (
              <button key={provider.providerId} type="button" onClick={() => setSelectedProviderId(provider.providerId)} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: provider.providerId === selectedProvider?.providerId && selectedProviderId !== "custom" ? "rgba(255,255,255,0.06)" : "transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{provider.providerLabel}</span>
                  <span style={{ color: provider.connected ? "var(--success, #42c97a)" : "var(--text-3)", fontSize: 11 }}>
                    {provider.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div style={{ color: "var(--text-3)", fontSize: 11 }}>{provider.providerId}</div>
              </button>
            ))}
          </div>
          <div style={{ padding: 16, overflow: "auto" }}>
            {selectedProviderId === "custom" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 600 }}>Custom provider</div>
                <div style={{ color: "var(--text-3)", fontSize: 12 }}>
                  OpenCode config API is preferred. Project `opencode.json` is only used if this runtime does not expose config endpoints.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input value={customProviderId} onChange={(event) => setCustomProviderId(event.target.value)} placeholder="Provider id" style={{ padding: 9, border: "1px solid var(--border)", borderRadius: 8 }} />
                  <input value={customProviderName} onChange={(event) => setCustomProviderName(event.target.value)} placeholder="Display name" style={{ padding: 9, border: "1px solid var(--border)", borderRadius: 8 }} />
                </div>
                <input value={customBaseUrl} onChange={(event) => setCustomBaseUrl(event.target.value)} placeholder="Base URL" style={{ padding: 9, border: "1px solid var(--border)", borderRadius: 8 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-outline" onClick={discoverModels} disabled={discovering}>{discovering ? "Searching..." : "Find models"}</button>
                  <button type="button" className="btn btn-primary" onClick={saveCustomProvider} disabled={saving}>{saving ? "Saving..." : "Save provider"}</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={customModelDraft} onChange={(event) => setCustomModelDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addManualModel(); } }} placeholder="Add model id manually" style={{ flex: 1, padding: 9, border: "1px solid var(--border)", borderRadius: 8 }} />
                  <button type="button" className="btn btn-outline" onClick={addManualModel}>Add</button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {customModels.map((modelId) => (
                    <label key={modelId} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
                      <input type="checkbox" checked={selectedCustomModels.includes(modelId)} onChange={() => toggleCustomModel(modelId)} />
                      <span>{modelId}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : selectedProvider ? (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>{selectedProvider.providerLabel}</div>
                      <span style={{ fontSize: 11, color: selectedProvider.connected ? "var(--success, #42c97a)" : "var(--text-3)" }}>
                        {selectedProvider.connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                    <div style={{ color: "var(--text-3)", fontSize: 12 }}>{selectedProvider.models.length} known models</div>
                  </div>
                  <button type="button" className="btn btn-outline" onClick={openConnect}>Open /connect fallback</button>
                </div>

                {loadingProviders ? (
                  <div style={{ color: "var(--text-3)", fontSize: 12 }}>Loading provider auth from OpenCode…</div>
                ) : null}

                {apiAuthMethods.length > 0 ? (
                  <div style={{ display: "grid", gap: 8, padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
                    <div style={{ fontWeight: 600 }}>API key</div>
                    <input ref={apiKeyInputRef} type="password" autoComplete="off" placeholder={authMethodLabel("Paste API key", apiAuthMethods[0]?.label)} style={{ padding: 9, border: "1px solid var(--border)", borderRadius: 8 }} />
                    <div>
                      <button type="button" className="btn btn-primary" onClick={saveApiKey} disabled={saving}>
                        {saving ? "Saving..." : authMethodLabel("Save key", apiAuthMethods[0]?.label)}
                      </button>
                    </div>
                  </div>
                ) : null}

                {oauthMethods.length > 0 ? (
                  <div style={{ display: "grid", gap: 8, padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
                    <div style={{ fontWeight: 600 }}>Browser auth</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {oauthMethods.map((method) => (
                        <button key={`${method.type}-${method.index}`} type="button" className="btn btn-outline" onClick={() => startOauth(method.index)} disabled={saving}>
                          {saving ? "Starting..." : authMethodLabel("Connect", method.label)}
                        </button>
                      ))}
                    </div>
                    {waitingForOauthCode ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <input value={oauthCode} onChange={(event) => setOauthCode(event.target.value)} placeholder="Paste OAuth code" style={{ padding: 9, border: "1px solid var(--border)", borderRadius: 8 }} />
                        <div>
                          <button type="button" className="btn btn-primary" onClick={completeOauth} disabled={saving}>
                            {saving ? "Completing..." : "Complete OAuth"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selectedProvider.authMethods.length === 0 ? (
                  <div style={{ color: "var(--text-3)", fontSize: 12 }}>
                    {providerApiUnsupported
                      ? "This runtime did not expose provider auth methods. Use the manual /connect fallback if you need to authenticate."
                      : "OpenCode did not report any auth methods for this provider."}
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 6 }}>
                  {visibleModels.slice(0, 80).map((model) => (
                    <div key={model.id} style={{ padding: 9, border: "1px solid var(--border)", borderRadius: 8 }}>
                      <div style={{ fontWeight: 600 }}>{model.displayName}</div>
                      <div style={{ color: "var(--text-3)", fontSize: 11 }}>{model.id}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--text-3)" }}>No providers matched.</div>
            )}
          </div>
        </div>
        {status ? <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12 }}>{status}</div> : null}
      </div>
    </div>
  );
}
