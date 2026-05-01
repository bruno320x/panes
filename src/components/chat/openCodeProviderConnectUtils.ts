import type {
  EngineModel,
  OpenCodeProviderAuthMethod,
  OpenCodeProviderAuthResponse,
  OpenCodeProviderListResponse,
} from "../../types";

export interface ProviderGroup {
  providerId: string;
  providerLabel: string;
  models: EngineModel[];
  connected: boolean;
  authMethods: Array<OpenCodeProviderAuthMethod & { index: number }>;
  envKeys: string[];
  source: string | null;
  defaultModelId: string | null;
}

export interface CustomProviderConfigInput {
  providerId: string;
  providerName: string;
  baseUrl: string;
  models: string[];
}

export function providerIdFor(modelId: string): string {
  const parts = modelId.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return "local";
  if (parts[0]?.toLowerCase() === "openrouter" && parts.length > 2) return parts[1].toLowerCase();
  return parts[0].toLowerCase();
}

export function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function modelsEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/models")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/models`;
  return `${trimmed}/v1/models`;
}

export function normalizeProviderId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function syntheticModel(providerId: string, modelId: string, displayName: string): EngineModel {
  return {
    id: `${providerId}/${modelId}`,
    displayName,
    description: "OpenCode model",
    hidden: false,
    isDefault: false,
    inputModalities: ["text"],
    attachmentModalities: [],
    supportsPersonality: false,
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: [],
  };
}

function normalizeAuthType(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("oauth") || normalized.includes("browser")) {
    return "oauth";
  }
  if (
    normalized.includes("api") ||
    normalized.includes("token") ||
    normalized.includes("key") ||
    normalized.includes("secret")
  ) {
    return "api";
  }
  return normalized;
}

function normalizeAuthMethodRecord(
  raw: unknown,
): OpenCodeProviderAuthMethod | null {
  if (typeof raw === "string") {
    const type = normalizeAuthType(raw) ?? "api";
    return {
      type,
      label: titleCase(raw),
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const type =
    normalizeAuthType(record.type) ??
    normalizeAuthType(record.kind) ??
    normalizeAuthType(record.method) ??
    normalizeAuthType(record.authType) ??
    "api";
  const label =
    typeof record.label === "string" && record.label.trim()
      ? record.label.trim()
      : typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : titleCase(`${type} auth`);

  return { type, label };
}

function authEntriesForProvider(
  providerId: string,
  authMap?: OpenCodeProviderAuthResponse | null,
): unknown[] {
  const raw = authMap?.[providerId];
  if (Array.isArray(raw)) {
    return raw;
  }

  if (!raw || typeof raw !== "object") {
    return [];
  }

  const record = raw as Record<string, unknown>;
  for (const key of ["methods", "auth", "items", "options"]) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  return [];
}

function dedupeAuthMethods(
  methods: OpenCodeProviderAuthMethod[],
): Array<OpenCodeProviderAuthMethod & { index: number }> {
  const seen = new Set<string>();
  return methods
    .filter((method) => {
      const key = `${method.type}::${method.label}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((method, index) => ({
      ...method,
      index,
    }));
}

function normalizeAuthMethods(
  providerId: string,
  authMap?: OpenCodeProviderAuthResponse | null,
  envKeys: string[] = [],
): Array<OpenCodeProviderAuthMethod & { index: number }> {
  const normalized = authEntriesForProvider(providerId, authMap)
    .map((method) => normalizeAuthMethodRecord(method))
    .filter((method): method is OpenCodeProviderAuthMethod => method !== null);

  if (normalized.length === 0 && envKeys.length > 0) {
    normalized.push({
      type: "api",
      label: envKeys.length === 1 ? envKeys[0] : "API key",
    });
  }

  return dedupeAuthMethods(normalized);
}

export function buildProviderCatalog(
  providerList: OpenCodeProviderListResponse | null | undefined,
  authMap: OpenCodeProviderAuthResponse | null | undefined,
  models: EngineModel[],
): ProviderGroup[] {
  const groups = new Map<string, ProviderGroup>();

  for (const model of models) {
    const providerId = providerIdFor(model.id);
    groups.set(providerId, {
      providerId,
      providerLabel: titleCase(providerId),
      models: [...(groups.get(providerId)?.models ?? []), model],
      connected: false,
      authMethods: [],
      envKeys: groups.get(providerId)?.envKeys ?? [],
      source: groups.get(providerId)?.source ?? null,
      defaultModelId: groups.get(providerId)?.defaultModelId ?? null,
    });
  }

  const connected = new Set((providerList?.connected ?? []).map((value) => value.trim().toLowerCase()));
  const providerDefaults = providerList?.default ?? {};
  for (const provider of providerList?.all ?? []) {
    const providerId = normalizeProviderId(provider.id ?? "");
    if (!providerId) continue;
    const existing = groups.get(providerId);
    const mergedModels = existing?.models?.length
      ? existing.models
      : Object.values(provider.models ?? {}).map((model) =>
          syntheticModel(providerId, model.id, model.name),
        );
    const envKeys = Array.isArray(provider.env)
      ? provider.env.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    groups.set(providerId, {
      providerId,
      providerLabel: provider.name?.trim() || existing?.providerLabel || titleCase(providerId),
      models: mergedModels,
      connected: connected.has(providerId),
      authMethods: normalizeAuthMethods(providerId, authMap, envKeys),
      envKeys,
      source: typeof provider.source === "string" && provider.source.trim() ? provider.source.trim() : existing?.source ?? null,
      defaultModelId:
        typeof providerDefaults[providerId] === "string" && providerDefaults[providerId]?.trim()
          ? providerDefaults[providerId].trim()
          : existing?.defaultModelId ?? null,
    });
  }

  for (const [providerId, group] of groups) {
    if (group.authMethods.length > 0) continue;
    groups.set(providerId, {
      ...group,
      connected: connected.has(providerId),
      authMethods: normalizeAuthMethods(providerId, authMap, group.envKeys),
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return a.providerLabel.localeCompare(b.providerLabel);
  });
}

export function buildCustomProviderConfigPatch(
  currentConfig: Record<string, unknown>,
  input: CustomProviderConfigInput,
): Record<string, unknown> {
  const providerMap =
    typeof currentConfig.provider === "object" && currentConfig.provider !== null && !Array.isArray(currentConfig.provider)
      ? { ...(currentConfig.provider as Record<string, unknown>) }
      : {};

  providerMap[input.providerId] = {
    npm: "@ai-sdk/openai-compatible",
    name: input.providerName.trim() || titleCase(input.providerId),
    options: {
      baseURL: input.baseUrl.trim().replace(/\/+$/, ""),
    },
    models: Object.fromEntries(
      input.models.map((modelId) => [modelId, { name: modelId }]),
    ),
  };

  return {
    ...currentConfig,
    provider: providerMap,
  };
}

export function removeCustomProviderConfigPatch(
  currentConfig: Record<string, unknown>,
  providerId: string,
): Record<string, unknown> {
  const providerMap =
    typeof currentConfig.provider === "object" && currentConfig.provider !== null && !Array.isArray(currentConfig.provider)
      ? { ...(currentConfig.provider as Record<string, unknown>) }
      : {};

  delete providerMap[providerId];

  return {
    ...currentConfig,
    provider: providerMap,
  };
}

export function isOpenCodeServerApiUnsupported(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return text.includes("http 404")
    || text.includes("http 405")
    || text.includes("not found")
    || text.includes("method not allowed");
}
