/**
 * Codex Skills Adapter
 * 
 * Converts Codex native skills to unified format.
 */

import type { CodexSkill } from "../../../types";
import type { UnifiedSkill, CodexSkillData } from "../../../components/skills/types";
import { skillRegistry, inferCategory } from "../skillRegistry";
import type { SkillsAdapter } from "./types";

/**
 * CodexSkillsAdapter - Adapter for Codex skills
 */
export class CodexSkillsAdapter implements SkillsAdapter {
  readonly engineId = "codex";

  private nativeSkills: CodexSkill[] = [];
  private activeSkillNames: Set<string> = new Set();
  private enabledSkills: Set<string> = new Set();

  async getAvailableSkills(): Promise<UnifiedSkill[]> {
    return this.nativeSkills.map((skill) => this.fromNativeSkill(skill)).filter(Boolean) as UnifiedSkill[];
  }

  async getActiveSkills(): Promise<UnifiedSkill[]> {
    return this.nativeSkills
      .filter((skill) => this.activeSkillNames.has(skill.name))
      .map((skill) => this.fromNativeSkill(skill))
      .filter(Boolean) as UnifiedSkill[];
  }

  async enableSkill(skillId: string): Promise<void> {
    const skill = skillRegistry.getSkill(skillId);
    if (skill && skill.engines.codex) {
      this.enabledSkills.add(skill.name);
    }
  }

  async disableSkill(skillId: string): Promise<void> {
    const skill = skillRegistry.getSkill(skillId);
    if (skill && skill.engines.codex) {
      this.enabledSkills.delete(skill.name);
    }
  }

  async isSkillEnabled(skillId: string): Promise<boolean> {
    const skill = skillRegistry.getSkill(skillId);
    if (!skill || !skill.engines.codex) return false;
    return this.enabledSkills.has(skill.name);
  }

  toNativeSkill(unified: UnifiedSkill): CodexSkill | null {
    if (!unified.engines.codex) return null;

    return {
      name: unified.name,
      path: unified.engines.codex.path,
      description: unified.description,
      enabled: unified.enabled,
      scope: unified.engines.codex.scope,
    };
  }

  fromNativeSkill(native: unknown): UnifiedSkill | null {
    if (!this.isCodexSkill(native)) return null;

    const skill = native as CodexSkill;
    const engineData: CodexSkillData = {
      native: true,
      path: skill.path,
      scope: skill.scope,
    };

    const unified: UnifiedSkill = {
      id: `codex:${skill.name}`,
      name: skill.name,
      description: skill.description || `Codex skill: ${skill.name}`,
      category: inferCategory(skill.name),
      engines: { codex: engineData },
      enabled: skill.enabled,
      scope: this.mapScope(skill.scope),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Register in global registry
    skillRegistry.addSkill(unified);
    return unified;
  }

  async refresh(): Promise<void> {
    // Skills are refreshed from Codex diagnostics
    // This is called when the engine reports skill changes
    this.enabledSkills.clear();
    this.activeSkillNames.clear();
  }

  /**
   * Update skills from Codex diagnostics.
   */
  updateFromDiagnostics(skills: CodexSkill[], activeSkills: string[]): void {
    this.nativeSkills = skills;
    this.activeSkillNames = new Set(activeSkills);

    // Register all skills
    for (const skill of skills) {
      this.fromNativeSkill(skill);
    }
  }

  private isCodexSkill(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const skill = value as Record<string, unknown>;
    return (
      typeof skill.name === "string" &&
      typeof skill.path === "string" &&
      typeof skill.description === "string"
    );
  }

  private mapScope(scope: string): "global" | "workspace" | "repo" {
    switch (scope.toLowerCase()) {
      case "global":
        return "global";
      case "workspace":
        return "workspace";
      case "repo":
      case "repository":
        return "repo";
      default:
        return "workspace";
    }
  }
}

/**
 * Singleton instance.
 */
export const codexSkillsAdapter = new CodexSkillsAdapter();
