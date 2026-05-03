/**
 * Skill Registry - Central registry for all skills
 * 
 * This module provides the core registry that holds all skills
 * and provides query methods.
 */

import type { UnifiedSkill, SkillEngine, SkillCategory } from "../../components/skills/types";

/**
 * SkillRegistry - Central registry for skills
 * 
 * Singleton that holds all skills and provides methods for querying
 * and managing them.
 */
export class SkillRegistry {
  private skills = new Map<string, UnifiedSkill>();

  /**
   * Add a skill to the registry.
   */
  addSkill(skill: UnifiedSkill): void {
    this.skills.set(skill.id, skill);
  }

  /**
   * Remove a skill from the registry.
   * Returns true if skill was found and removed.
   */
  removeSkill(skillId: string): boolean {
    return this.skills.delete(skillId);
  }

  /**
   * Get a skill by ID.
   */
  getSkill(skillId: string): UnifiedSkill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Get all skills.
   */
  getAllSkills(): UnifiedSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills that support a specific engine.
   */
  getSkillsForEngine(engine: SkillEngine): UnifiedSkill[] {
    return this.getAllSkills().filter(
      (skill) => skill.engines[engine] !== undefined,
    );
  }

  /**
   * Get skills by category.
   */
  getSkillsByCategory(category: SkillCategory): UnifiedSkill[] {
    return this.getAllSkills().filter((skill) => skill.category === category);
  }

  /**
   * Get enabled skills for an engine.
   */
  getEnabledSkillsForEngine(
    engine: SkillEngine,
    engineEnabled: Record<string, boolean>,
  ): UnifiedSkill[] {
    return this.getSkillsForEngine(engine).filter(
      (skill) => engineEnabled[skill.id] !== false,
    );
  }

  /**
   * Check if a skill is supported for an engine.
   */
  isSkillSupportedForEngine(skillId: string, engine: SkillEngine): boolean {
    const skill = this.skills.get(skillId);
    return skill?.engines[engine] !== undefined;
  }

  /**
   * Update a skill.
   */
  updateSkill(skillId: string, updates: Partial<UnifiedSkill>): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    this.skills.set(skillId, { ...skill, ...updates });
    return true;
  }

  /**
   * Bulk add skills.
   */
  addSkills(skills: UnifiedSkill[]): void {
    for (const skill of skills) {
      this.addSkill(skill);
    }
  }

  /**
   * Clear all skills.
   */
  clear(): void {
    this.skills.clear();
  }

  /**
   * Get skill count.
   */
  get count(): number {
    return this.skills.size;
  }

  /**
   * Search skills by name or description.
   */
  search(query: string): UnifiedSkill[] {
    const lower = query.toLowerCase();
    return this.getAllSkills().filter(
      (skill) =>
        skill.name.toLowerCase().includes(lower) ||
        skill.description.toLowerCase().includes(lower),
    );
  }
}

/**
 * Global skill registry instance.
 */
export const skillRegistry = new SkillRegistry();

/**
 * Infer category from skill name.
 */
export function inferCategory(name: string): SkillCategory {
  const lower = name.toLowerCase();

  if (
    lower.includes("react") ||
    lower.includes("vue") ||
    lower.includes("angular") ||
    lower.includes("css") ||
    lower.includes("html") ||
    lower.includes("svelte")
  ) {
    return "frontend";
  }

  if (
    lower.includes("python") ||
    lower.includes("node") ||
    lower.includes("java") ||
    lower.includes("go") ||
    lower.includes("rust") ||
    lower.includes("ruby") ||
    lower.includes("dotnet")
  ) {
    return "backend";
  }

  if (
    lower.includes("sql") ||
    lower.includes("data") ||
    lower.includes("pandas") ||
    lower.includes("analytics") ||
    lower.includes("etl")
  ) {
    return "data";
  }

  if (
    lower.includes("docker") ||
    lower.includes("kubernetes") ||
    lower.includes("k8s") ||
    lower.includes("aws") ||
    lower.includes("gcp") ||
    lower.includes("azure") ||
    lower.includes("ci/cd") ||
    lower.includes("github actions")
  ) {
    return "devops";
  }

  if (
    lower.includes("security") ||
    lower.includes("auth") ||
    lower.includes("encrypt") ||
    lower.includes("oauth") ||
    lower.includes("jwt")
  ) {
    return "security";
  }

  if (
    lower.includes("test") ||
    lower.includes("jest") ||
    lower.includes("cypress") ||
    lower.includes("playwright") ||
    lower.includes("unit")
  ) {
    return "testing";
  }

  return "custom";
}

/**
 * Generate a unique skill ID.
 */
export function generateSkillId(engine: SkillEngine, name: string): string {
  return `${engine}:${name.toLowerCase().replace(/\s+/g, "-")}`;
}
