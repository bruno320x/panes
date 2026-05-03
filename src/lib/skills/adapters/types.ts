/**
 * Skills Adapter - Common Interface
 * 
 * All engine-specific adapters must implement this interface.
 */

import type { UnifiedSkill } from "../../../components/skills/types";

/**
 * SkillsAdapter - Interface for engine-specific skill adapters
 * 
 * Each engine (Codex, OpenCode, Claude) has its own way of
 * exposing and managing skills. Adapters normalize these into
 * the unified UnifiedSkill format.
 */
export interface SkillsAdapter {
  /** The engine this adapter handles */
  readonly engineId: string;

  /**
   * Get all available skills for this engine.
   * Returns skills that can be selected/configured by the user.
   */
  getAvailableSkills(): Promise<UnifiedSkill[]>;

  /**
   * Get the currently active/selected skills.
   * Returns the skills that are currently in use.
   */
  getActiveSkills(): Promise<UnifiedSkill[]>;

  /**
   * Enable a skill.
   * @param skillId - The skill to enable
   */
  enableSkill(skillId: string): Promise<void>;

  /**
   * Disable a skill.
   * @param skillId - The skill to disable
   */
  disableSkill(skillId: string): Promise<void>;

  /**
   * Check if a skill is enabled.
   * @param skillId - The skill to check
   */
  isSkillEnabled(skillId: string): Promise<boolean>;

  /**
   * Get the native skill data for a unified skill.
   * Returns the engine-specific representation.
   */
  toNativeSkill(unified: UnifiedSkill): unknown;

  /**
   * Convert a native skill to unified format.
   * @param native - The engine-specific skill data
   */
  fromNativeSkill(native: unknown): UnifiedSkill | null;

  /**
   * Refresh skills from the engine.
   * Call this when the engine reports skill changes.
   */
  refresh(): Promise<void>;
}
