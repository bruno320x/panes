/**
 * Skills Module - Public API
 * 
 * Export all public interfaces and utilities for the skills system.
 */

// Types
export type {
  UnifiedSkill,
  SkillCategory,
  SkillScope,
  SkillEngine,
  CodexSkillData,
  OpenCodeSkillData,
  ClaudeSkillData,
  SkillsStoreState,
  SkillsChangeEvent,
  NewSkillInput,
  SkillUpdate,
} from "../../components/skills/types";

// Registry
export { skillRegistry, generateSkillId, inferCategory } from "./skillRegistry";
export type { SkillRegistry } from "./skillRegistry";

// Store
export { skillsStore } from "./store";

// Adapters
export { CodexSkillsAdapter } from "./adapters/codexAdapter";
export { OpenCodeAgentsAdapter } from "./adapters/openCodeAdapter";
export { ClaudePersonasAdapter } from "./adapters/claudeAdapter";
export type { SkillsAdapter } from "./adapters/types";
