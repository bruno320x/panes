/**
 * Skills Components - Public API
 * 
 * Export all skills-related components and utilities.
 */

// Components
export { SkillsPanel, SkillButton } from "./SkillsPanel";
export type { SkillsPanelProps, SkillButtonProps } from "./SkillsPanel";

// Hooks
export { useSkills, useSkillAdapter, useSkillSelection } from "./useSkills";

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
} from "./types";
