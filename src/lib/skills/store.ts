/**
 * Skills Store - Persistence layer for skills
 * 
 * This module provides persistence for skills using localStorage
 * and manages engine-specific overrides.
 */

import { skillRegistry } from "./skillRegistry";
import type { UnifiedSkill, SkillEngine, SkillsStoreState } from "../../components/skills/types";

const STORAGE_KEY = "panes:skills";

/**
 * SkillsStore - Manages persistence and state
 */
class SkillsStore {
  private engineOverrides: Record<string, Record<string, boolean>> = {};
  private listeners = new Set<() => void>();

  constructor() {
    this.hydrate();
  }

  /**
   * Hydrate state from localStorage.
   */
  hydrate(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SkillsStoreState = JSON.parse(stored);
        this.engineOverrides = parsed.engineOverrides || {};
        
        // Register skills in the registry
        if (parsed.skills && Array.isArray(parsed.skills)) {
          skillRegistry.clear();
          skillRegistry.addSkills(parsed.skills);
        }
      }
    } catch (error) {
      console.warn("[SkillsStore] Failed to hydrate:", error);
      this.engineOverrides = {};
    }
  }

  /**
   * Persist state to localStorage.
   */
  persist(): void {
    try {
      const state: SkillsStoreState = {
        skills: skillRegistry.getAllSkills(),
        engineOverrides: this.engineOverrides,
        lastSync: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.notify();
    } catch (error) {
      console.warn("[SkillsStore] Failed to persist:", error);
    }
  }

  /**
   * Subscribe to changes.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners.
   */
  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Add a skill.
   */
  addSkill(skill: UnifiedSkill): void {
    skillRegistry.addSkill(skill);
    this.persist();
  }

  /**
   * Remove a skill.
   */
  removeSkill(skillId: string): void {
    skillRegistry.removeSkill(skillId);
    // Clean up overrides
    for (const engine of Object.keys(this.engineOverrides)) {
      delete this.engineOverrides[engine][skillId];
    }
    this.persist();
  }

  /**
   * Toggle a skill for an engine.
   */
  toggleSkill(skillId: string, engineId: string): void {
    if (!this.engineOverrides[engineId]) {
      this.engineOverrides[engineId] = {};
    }

    const current = this.engineOverrides[engineId][skillId];
    // If not set, enable it (toggle on). If already enabled, disable it.
    this.engineOverrides[engineId][skillId] = current === false ? true : true;
    
    // Actually toggle: if undefined or true, set to false; if false, set to true
    if (this.engineOverrides[engineId][skillId] === undefined || 
        this.engineOverrides[engineId][skillId] === true) {
      this.engineOverrides[engineId][skillId] = false;
    } else {
      this.engineOverrides[engineId][skillId] = true;
    }
    
    this.persist();
  }

  /**
   * Check if a skill is enabled for an engine.
   */
  isEnabled(skillId: string, engineId: string): boolean {
    // First check if skill exists for this engine
    const skill = skillRegistry.getSkill(skillId);
    if (!skill || !skill.engines[engineId as SkillEngine]) {
      return false;
    }

    // Check override
    const override = this.engineOverrides[engineId]?.[skillId];
    if (override !== undefined) {
      return override;
    }

    // Default to skill's enabled state
    return skill.enabled;
  }

  /**
   * Get skills for an engine with enabled state applied.
   */
  getSkillsForEngine(engineId: string): UnifiedSkill[] {
    const skills = skillRegistry.getSkillsForEngine(engineId as SkillEngine);
    return skills.map((skill) => ({
      ...skill,
      enabled: this.isEnabled(skill.id, engineId),
    }));
  }

  /**
   * Get enabled skills for an engine.
   */
  getEnabledSkillsForEngine(engineId: string): UnifiedSkill[] {
    return this.getSkillsForEngine(engineId).filter((skill) => skill.enabled);
  }

  /**
   * Set skill enabled state.
   */
  setEnabled(skillId: string, engineId: string, enabled: boolean): void {
    if (!this.engineOverrides[engineId]) {
      this.engineOverrides[engineId] = {};
    }
    this.engineOverrides[engineId][skillId] = enabled;
    this.persist();
  }

  /**
   * Reset all overrides for an engine.
   */
  resetEngine(engineId: string): void {
    delete this.engineOverrides[engineId];
    this.persist();
  }

  /**
   * Clear all data.
   */
  clear(): void {
    this.engineOverrides = {};
    skillRegistry.clear();
    localStorage.removeItem(STORAGE_KEY);
    this.notify();
  }
}

/**
 * Global skills store instance.
 */
export const skillsStore = new SkillsStore();
