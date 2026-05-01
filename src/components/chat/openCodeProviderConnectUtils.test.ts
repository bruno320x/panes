import { describe, expect, it } from "vitest";
import {
  buildCustomProviderConfigPatch,
  buildProviderCatalog,
  isOpenCodeServerApiUnsupported,
  removeCustomProviderConfigPatch,
} from "./openCodeProviderConnectUtils";
import type { EngineModel } from "../../types";

const MODELS: EngineModel[] = [
  {
    id: "anthropic/claude-sonnet-4-5",
    displayName: "Claude Sonnet 4.5",
    description: "OpenCode model",
    hidden: false,
    isDefault: true,
    inputModalities: ["text"],
    attachmentModalities: [],
    supportsPersonality: false,
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: [],
  },
  {
    id: "openai/gpt-4.1",
    displayName: "GPT-4.1",
    description: "OpenCode model",
    hidden: false,
    isDefault: false,
    inputModalities: ["text"],
    attachmentModalities: [],
    supportsPersonality: false,
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: [],
  },
];

describe("buildProviderCatalog", () => {
  it("prefers server providers, auth methods, and connection state over model-derived defaults", () => {
    const catalog = buildProviderCatalog(
      {
        all: [
          {
            id: "anthropic",
            name: "Anthropic",
            env: ["ANTHROPIC_API_KEY"],
            models: {
              "claude-sonnet-4-5": { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
            },
          },
        ],
        connected: ["anthropic"],
        default: {},
      },
      {
        anthropic: [
          { type: "api", label: "API key" },
          { type: "oauth", label: "OAuth" },
        ],
      },
      MODELS,
    );

    expect(catalog).toHaveLength(2);
    expect(catalog[0]).toMatchObject({
      providerId: "anthropic",
      providerLabel: "Anthropic",
      connected: true,
      envKeys: ["ANTHROPIC_API_KEY"],
      source: null,
      defaultModelId: null,
      authMethods: [
        { type: "api", label: "API key", index: 0 },
        { type: "oauth", label: "OAuth", index: 1 },
      ],
    });
    expect(catalog[0]?.models.map((model) => model.id)).toEqual(["anthropic/claude-sonnet-4-5"]);
    expect(catalog[1]).toMatchObject({
      providerId: "openai",
      connected: false,
      authMethods: [],
    });
  });

  it("synthesizes an API-key auth method when the provider exposes env keys but no auth schema", () => {
    const catalog = buildProviderCatalog(
      {
        all: [
          {
            id: "xiaomi-token-plan-ams",
            name: "Xiaomi Token Plan (Europe)",
            env: ["XIAOMI_API_KEY"],
            models: {
              "mimo-v2-5": { id: "mimo-v2-5", name: "MiMo-V2.5" },
            },
          },
        ],
        connected: [],
        default: {},
      },
      {},
      [],
    );

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      providerId: "xiaomi-token-plan-ams",
      envKeys: ["XIAOMI_API_KEY"],
      source: null,
      defaultModelId: null,
      authMethods: [{ type: "api", label: "XIAOMI_API_KEY", index: 0 }],
    });
  });

  it("preserves provider source and default model metadata from the runtime", () => {
    const catalog = buildProviderCatalog(
      {
        all: [
          {
            id: "openai",
            name: "OpenAI",
            source: "config",
            env: ["OPENAI_API_KEY"],
            models: {
              "gpt-5": { id: "gpt-5", name: "GPT-5" },
            },
          },
        ],
        connected: ["openai"],
        default: {
          openai: "gpt-5",
        },
      },
      {
        openai: [{ type: "api", label: "API key" }],
      },
      [],
    );

    expect(catalog[0]).toMatchObject({
      providerId: "openai",
      source: "config",
      defaultModelId: "gpt-5",
      connected: true,
    });
  });
});

describe("buildCustomProviderConfigPatch", () => {
  it("preserves existing config while replacing only the target provider entry", () => {
    const patch = buildCustomProviderConfigPatch(
      {
        model: "anthropic/claude-sonnet-4-5",
        provider: {
          anthropic: {
            npm: "@ai-sdk/anthropic",
          },
          old: {
            npm: "@ai-sdk/openai-compatible",
            name: "Old",
          },
        },
      },
      {
        providerId: "old",
        providerName: "New Provider",
        baseUrl: "https://example.test/v1",
        models: ["a", "b"],
      },
    );

    expect(patch).toEqual({
      model: "anthropic/claude-sonnet-4-5",
      provider: {
        anthropic: {
          npm: "@ai-sdk/anthropic",
        },
        old: {
          npm: "@ai-sdk/openai-compatible",
          name: "New Provider",
          options: {
            baseURL: "https://example.test/v1",
          },
          models: {
            a: { name: "a" },
            b: { name: "b" },
          },
        },
      },
    });
  });
});

describe("removeCustomProviderConfigPatch", () => {
  it("removes only the requested provider entry", () => {
    const patch = removeCustomProviderConfigPatch(
      {
        provider: {
          anthropic: { npm: "@ai-sdk/anthropic" },
          custom: { npm: "@ai-sdk/openai-compatible" },
        },
        model: "anthropic/claude-sonnet-4-5",
      },
      "custom",
    );

    expect(patch).toEqual({
      provider: {
        anthropic: { npm: "@ai-sdk/anthropic" },
      },
      model: "anthropic/claude-sonnet-4-5",
    });
  });
});

describe("isOpenCodeServerApiUnsupported", () => {
  it("detects unsupported endpoint failures without matching generic request errors", () => {
    expect(isOpenCodeServerApiUnsupported("OpenCode request failed: HTTP 404 Not Found")).toBe(true);
    expect(isOpenCodeServerApiUnsupported("OpenCode request failed: HTTP 405 Method Not Allowed")).toBe(true);
    expect(isOpenCodeServerApiUnsupported("failed to parse OpenCode config")).toBe(false);
  });
});
