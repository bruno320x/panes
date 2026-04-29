import { describe, expect, it } from "vitest";
import {
  buildCustomProviderConfigPatch,
  buildProviderCatalog,
  isOpenCodeServerApiUnsupported,
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

describe("isOpenCodeServerApiUnsupported", () => {
  it("detects unsupported endpoint failures without matching generic request errors", () => {
    expect(isOpenCodeServerApiUnsupported("OpenCode request failed: HTTP 404 Not Found")).toBe(true);
    expect(isOpenCodeServerApiUnsupported("OpenCode request failed: HTTP 405 Method Not Allowed")).toBe(true);
    expect(isOpenCodeServerApiUnsupported("failed to parse OpenCode config")).toBe(false);
  });
});
