/**
 * Unified Skills System - Type Definitions
 * 
 * This module defines the unified skill type that works across all engines
 * (Codex, OpenCode, Claude) with engine-specific adapters.
 */

/**
 * Skill categories for organization and filtering.
 */
export type SkillCategory =
  | "frontend"
  | "backend"
  | "data"
  | "devops"
  | "security"
  | "testing"
  | "custom";

/**
 * Skill scope - where the skill is available.
 */
export type SkillScope = "global" | "workspace" | "repo";

/**
 * Supported engine types.
 */
export type SkillEngine = "codex" | "opencode" | "claude";

/**
 * Data specific to Codex skills.
 */
export interface CodexSkillData {
  native: true;
  path: string;
  scope: string;
}

/**
 * Data specific to OpenCode skills.
 * OpenCode doesn't have native skills, so we map commands and agents.
 */
export interface OpenCodeSkillData {
  command?: string;
  agent?: string;
  provider?: string;
}

/**
 * Data specific to Claude skills.
 * Claude uses instruction templates.
 */
export interface ClaudeSkillData {
  instruction?: string;
  promptTemplate?: string;
}

/**
 * Unified skill representation that works across all engines.
 */
export interface UnifiedSkill {
  /** Unique identifier within the system */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description of what the skill does */
  description: string;
  
  /** Category for organization */
  category: SkillCategory;
  
  /** Engine-specific data */
  engines: {
    codex?: CodexSkillData;
    opencode?: OpenCodeSkillData;
    claude?: ClaudeSkillData;
  };
  
  /** Whether the skill is currently enabled */
  enabled: boolean;
  
  /** Scope of availability */
  scope: SkillScope;
  
  /** Optional icon (emoji or icon name) */
  icon?: string;
  
  /** When the skill was created */
  createdAt: string;
  
  /** When the skill was last updated */
  updatedAt: string;
}

/**
 * Skills store state for persistence.
 */
export interface SkillsStoreState {
  /** All registered skills */
  skills: UnifiedSkill[];
  
  /** Engine-specific overrides: engineId -> skillId -> enabled */
  engineOverrides: Record<string, Record<string, boolean>>;
  
  /** Last sync timestamp */
  lastSync: string;
}

/**
 * Event emitted when skills change.
 */
export interface SkillsChangeEvent {
  type: "added" | "removed" | "updated" | "toggled";
  skillId: string;
  engineId?: SkillEngine;
}

/**
 * Helper type for creating a new skill.
 */
export type NewSkillInput = Omit<UnifiedSkill, "id" | "createdAt" | "updatedAt">;

/**
 * Helper type for updating a skill.
 */
export type SkillUpdate = Partial<Omit<UnifiedSkill, "id" | "createdAt">>;
