/**
 * Engine Feature Flags
 * 
 * Centralized feature availability definitions for each engine.
 * Use EngineFeatureRenderer to conditionally render UI elements based on engine capabilities.
 */

export interface EngineFeatureMap {
  planMode: boolean;
  serviceTier: boolean;
  reasoningEffort: boolean;
  slashCommands: readonly string[];
  skills: boolean;
  agentPicker: boolean;
  providerTree: boolean;
  statusBar: boolean;
  sandboxMode: boolean;
}

export const ENGINE_FEATURES = {
  codex: {
    planMode: true,
    serviceTier: true,
    reasoningEffort: true,
    slashCommands: [
      "/skills", "/review", "/personality", "/debug", "/test",
      "/plan", "/fork", "/compact", "/context", "/help"
    ],
    skills: true,
    agentPicker: false,
    providerTree: false,
    statusBar: true,
    sandboxMode: true,
  },
  opencode: {
    planMode: false,
    serviceTier: false,
    reasoningEffort: true,
    slashCommands: ["/help", "/search", "/execute"],
    skills: false,
    agentPicker: true,
    providerTree: true,
    statusBar: false,
    sandboxMode: false,
  },
  claude: {
    planMode: true,
    serviceTier: false,
    reasoningEffort: true,
    slashCommands: [],
    skills: false,
    agentPicker: false,
    providerTree: false,
    statusBar: false,
    sandboxMode: true,
  },
} as const satisfies Record<string, EngineFeatureMap>;

export type EngineId = keyof typeof ENGINE_FEATURES;

export type FeatureKey = keyof EngineFeatureMap;

/**
 * Get features for a specific engine, with fallback for unknown engines
 */
export function getEngineFeatures(engineId: string): EngineFeatureMap {
  if (engineId in ENGINE_FEATURES) {
    return ENGINE_FEATURES[engineId as EngineId];
  }
  // Return empty features for unknown engines
  return {
    planMode: false,
    serviceTier: false,
    reasoningEffort: false,
    slashCommands: [],
    skills: false,
    agentPicker: false,
    providerTree: false,
    statusBar: false,
    sandboxMode: false,
  };
}

/**
 * Check if a specific feature is available for an engine
 */
export function isFeatureAvailable(
  engineId: string,
  feature: FeatureKey
): boolean {
  const features = getEngineFeatures(engineId);
  return features[feature] as boolean;
}

/**
 * Get the list of slash commands available for an engine
 */
export function getSlashCommands(engineId: string): readonly string[] {
  const features = getEngineFeatures(engineId);
  return features.slashCommands;
}
