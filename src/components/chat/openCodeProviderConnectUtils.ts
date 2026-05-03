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

function normalizeAuthMethods(
  providerId: string,
  authMap?: OpenCodeProviderAuthResponse | null,
): Array<OpenCodeProviderAuthMethod & { index: number }> {
  const raw = authMap?.[providerId] ?? [];
  return raw
    .map((method, index) => ({
      index,
      type: typeof method?.type === "string" ? method.type : "api",
      label: typeof method?.label === "string" && method.label.trim() ? method.label : titleCase(`${method?.type ?? "api"} auth`),
    }));
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
    });
  }

  const connected = new Set((providerList?.connected ?? []).map((value) => value.trim().toLowerCase()));
  for (const provider of providerList?.all ?? []) {
    const providerId = normalizeProviderId(provider.id ?? "");
    if (!providerId) continue;
    const existing = groups.get(providerId);
    const mergedModels = existing?.models?.length
      ? existing.models
      : Object.values(provider.models ?? {}).map((model) =>
          syntheticModel(providerId, model.id, model.name),
        );
    groups.set(providerId, {
      providerId,
      providerLabel: provider.name?.trim() || existing?.providerLabel || titleCase(providerId),
      models: mergedModels,
      connected: connected.has(providerId),
      authMethods: normalizeAuthMethods(providerId, authMap),
    });
  }

  for (const [providerId, group] of groups) {
    if (group.authMethods.length > 0) continue;
    groups.set(providerId, {
      ...group,
      connected: connected.has(providerId),
      authMethods: normalizeAuthMethods(providerId, authMap),
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

export function isOpenCodeServerApiUnsupported(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return text.includes("http 404")
    || text.includes("http 405")
    || text.includes("not found")
    || text.includes("method not allowed");
}
