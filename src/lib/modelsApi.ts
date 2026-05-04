// ============================================================
// Models.dev API Client - Capabilidades dinâmicas de modelos
// ============================================================

import type { ChatEngineId } from '../types';

const MODELS_DEV_API = 'https://models.dev/api.json';

// Cache em memória
let cache: ModelDevCatalog | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

export interface ModelDevCapabilities {
  id: string;
  name: string;
  reasoning: boolean;
  tool_call: boolean;
  attachment: boolean;
  temperature: boolean;
  modalities: { input: string[]; output: string[] };
  cost: { input: number; output: number };
  limit: { context: number; output: number };
  release_date: string;
  last_updated: string;
}

export interface ModelDevProvider {
  id: string;
  env: string[];
  api: string;
  name: string;
  models: Record<string, ModelDevCapabilities>;
}

export interface ModelDevCatalog {
  [providerId: string]: ModelDevProvider;
}

// Provider IDs no Models.dev vs Panes
const PROVIDER_MAP: Record<string, string[]> = {
  openai: ['openai'],
  anthropic: ['anthropic'],
  google: ['google', 'gemini'],
  opencode: ['opencode'],
  ollama: ['ollama'],
  local: ['local'],
};

/**
 * Busca catálogo do Models.dev (com cache)
 */
export async function fetchModelCatalog(): Promise<ModelDevCatalog> {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) {
    return cache;
  }

  try {
    const response = await fetch(MODELS_DEV_API, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as ModelDevCatalog;
    cache = data;
    cacheTime = now;
    return data;
  } catch (err) {
    console.warn('[modelsApi] Falha ao buscar Models.dev, usando cache ou fallback:', err);
    return cache ?? {};
  }
}

/**
 * Verifica se um modelo suporta reasoning baseado no Models.dev
 */
export async function modelSupportsReasoning(
  providerId: string,
  modelId: string
): Promise<boolean> {
  const catalog = await fetchModelCatalog();
  const providerIds = PROVIDER_MAP[providerId] ?? [providerId];

  for (const pid of providerIds) {
    const provider = catalog[pid];
    if (!provider) continue;

    // Busca exata ou por substring no ID
    const modelKey = Object.keys(provider.models).find(
      (key) =>
        key === modelId ||
        key.toLowerCase() === modelId.toLowerCase() ||
        modelId.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(modelId.toLowerCase())
    );

    if (modelKey) {
      return provider.models[modelKey].reasoning;
    }
  }

  return false;
}

/**
 * Retorna opções de reasoning effort para modelos que suportam
 */
export function getReasoningEffortOptions(
  providerId: string,
  modelId: string
): Array<{ reasoningEffort: string; description: string }> {
  const modelLower = modelId.toLowerCase();

  // Modelos o1/o3 da OpenAI - opções padrão
  if (
    providerId === 'openai' &&
    (modelLower.includes('o1') || modelLower.includes('o3') || modelLower.includes('o4'))
  ) {
    return [
      { reasoningEffort: 'low', description: 'Fast' },
      { reasoningEffort: 'medium', description: 'Balanced' },
      { reasoningEffort: 'high', description: 'Deep' },
    ];
  }

  // Anthropic com reasoning
  if (
    providerId === 'anthropic' &&
    (modelLower.includes('claude-sonnet-4') || modelLower.includes('claude-opus-4'))
  ) {
    return [
      { reasoningEffort: 'low', description: 'Speed' },
      { reasoningEffort: 'medium', description: 'Balanced' },
      { reasoningEffort: 'high', description: 'Depth' },
    ];
  }

  // Gemini
  if (providerId === 'google' && modelLower.includes('gemini')) {
    return [
      { reasoningEffort: 'low', description: 'Fast' },
      { reasoningEffort: 'medium', description: 'Balanced' },
      { reasoningEffort: 'high', description: 'Deep' },
    ];
  }

  return [];
}

/**
 * Versão síncrona (usa cache ou defaults)
 */
export function modelSupportsReasoningSync(
  providerId: string,
  modelId: string
): boolean {
  if (!cache) return false;
  return modelSupportsReasoning(providerId, modelId) as unknown as boolean;
}
