/**
 * Claude Personas Adapter
 * 
 * Claude doesn't have a native "skills" concept like Codex,
 * but we can treat custom instructions and prompts as "skills".
 * 
 * This adapter provides a foundation for future Claude persona support.
 */

import type { UnifiedSkill, ClaudeSkillData } from "../../../components/skills/types";
import { skillRegistry } from "../skillRegistry";
import type { SkillsAdapter } from "./types";

/**
 * ClaudePersonasAdapter - Adapter for Claude custom instructions/personas
 * 
 * Claude supports:
 * - Custom system prompts/instructions
 * - Pre-built personas ( Analyst, Developer, etc.)
 * 
 * For now, we provide a minimal implementation that can be extended
 * when persona support is added to the Claude integration.
 */
export class ClaudePersonasAdapter implements SkillsAdapter {
  readonly engineId = "claude";

  private personas: Map<string, UnifiedSkill> = new Map();
  private activePersona: string | null = null;
  private enabledPersonas: Set<string> = new Set();

  /**
   * Built-in Claude personas.
   * These are predefined personas that can be used.
   */
  private static BUILTIN_PERSONAS: Array<{
    id: string;
    name: string;
    description: string;
    instruction: string;
  }> = [
    {
      id: "claude:analyst",
      name: "Analyst",
      description: "Specialized in analyzing code, data, and systems",
      instruction:
        "You are a careful analyst. Provide thorough, precise analysis with supporting evidence.",
    },
    {
      id: "claude:developer",
      name: "Developer",
      description: "Focused on writing, reviewing, and refactoring code",
      instruction:
        "You are an expert developer. Write clean, efficient, well-documented code.",
    },
    {
      id: "claude:reviewer",
      name: "Code Reviewer",
      description: "Expert at reviewing code for bugs, security, and best practices",
      instruction:
        "You are a meticulous code reviewer. Focus on quality, security, and maintainability.",
    },
    {
      id: "claude:documenter",
      name: "Technical Writer",
      description: "Specialized in writing documentation and technical content",
      instruction:
        "You are a technical writer. Create clear, comprehensive documentation.",
    },
    {
      id: "claude:debugger",
      name: "Debugger",
      description: "Expert at finding and fixing bugs in code",
      instruction:
        "You are a debugging expert. Systematically identify root causes and propose fixes.",
    },
  ];

  constructor() {
    // Register built-in personas
    for (const persona of ClaudePersonasAdapter.BUILTIN_PERSONAS) {
      this.registerPersona(persona);
    }
  }

  async getAvailableSkills(): Promise<UnifiedSkill[]> {
    return Array.from(this.personas.values());
  }

  async getActiveSkills(): Promise<UnifiedSkill[]> {
    if (!this.activePersona) return [];
    const persona = this.personas.get(this.activePersona);
    return persona ? [persona] : [];
  }

  async enableSkill(skillId: string): Promise<void> {
    if (this.personas.has(skillId)) {
      this.enabledPersonas.add(skillId);
    }
  }

  async disableSkill(skillId: string): Promise<void> {
    this.enabledPersonas.delete(skillId);
  }

  async isSkillEnabled(skillId: string): Promise<boolean> {
    if (!this.personas.has(skillId)) return false;
    
    // If explicitly disabled, return false
    if (this.enabledPersonas.has(`!${skillId}`)) return false;
    
    // If explicitly enabled, return true
    if (this.enabledPersonas.has(skillId)) return true;
    
    // Default: built-in personas are enabled by default
    return skillId.startsWith("claude:");
  }

  toNativeSkill(unified: UnifiedSkill): ClaudeSkillData | null {
    if (!unified.engines.claude) return null;

    return {
      instruction: unified.engines.claude.instruction,
      promptTemplate: unified.engines.claude.promptTemplate,
    };
  }

  fromNativeSkill(native: unknown): UnifiedSkill | null {
    if (typeof native !== "object" || native === null) return null;

    const data = native as Record<string, unknown>;
    if (typeof data.name !== "string") return null;

    const engineData: ClaudeSkillData = {
      instruction: data.instruction as string | undefined,
      promptTemplate: data.promptTemplate as string | undefined,
    };

    const unified: UnifiedSkill = {
      id: `claude:${data.name}`,
      name: data.name as string,
      description: (data.description as string) || `Claude persona: ${data.name}`,
      category: "custom",
      engines: { claude: engineData },
      enabled: true,
      scope: "global",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return unified;
  }

  async refresh(): Promise<void> {
    // No-op for now - personas are built-in
  }

  /**
   * Register a custom persona.
   */
  registerPersona(persona: {
    id: string;
    name: string;
    description: string;
    instruction: string;
  }): void {
    const engineData: ClaudeSkillData = {
      instruction: persona.instruction,
    };

    const unified: UnifiedSkill = {
      id: persona.id,
      name: persona.name,
      description: persona.description,
      category: "custom",
      engines: { claude: engineData },
      enabled: true,
      scope: "global",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.personas.set(unified.id, unified);
    skillRegistry.addSkill(unified);
  }

  /**
   * Set the active persona.
   */
  setActivePersona(personaId: string | null): void {
    if (personaId === null || this.personas.has(personaId)) {
      this.activePersona = personaId;
    }
  }

  /**
   * Get active persona ID.
   */
  getActivePersona(): string | null {
    return this.activePersona;
  }

  /**
   * Get instruction for active persona.
   */
  getActiveInstruction(): string | null {
    if (!this.activePersona) return null;
    const persona = this.personas.get(this.activePersona);
    return persona?.engines.claude?.instruction || null;
  }
}

/**
 * Singleton instance.
 */
export const claudePersonasAdapter = new ClaudePersonasAdapter();
