/**
 * OpenCode Agents Adapter
 * 
 * OpenCode doesn't have "skills" per se, but it has agents and commands
 * that can be represented as skills in the unified system.
 * 
 * Key insight: OpenCode agents are essentially "personas" that can be
 * activated, similar to how Codex skills work.
 */

import type { OpenCodeAgent, OpenCodeCommand } from "../../../types";
import type { UnifiedSkill, OpenCodeSkillData } from "../../../components/skills/types";
import { skillRegistry, inferCategory } from "../skillRegistry";
import type { SkillsAdapter } from "./types";

/**
 * OpenCodeSkillsAdapter - Adapter for OpenCode agents/commands
 * 
 * OpenCode has:
 * - Agents: Named AI personas (build, plan, etc.)
 * - Commands: Executable commands with optional agent association
 * 
 * We treat agents as "skills" since they represent capabilities
 * that can be activated by the user.
 */
export class OpenCodeAgentsAdapter implements SkillsAdapter {
  readonly engineId = "opencode";

  private agents: OpenCodeAgent[] = [];
  private commands: OpenCodeCommand[] = [];
  private activeAgent: string | null = null;
  private enabledAgents: Set<string> = new Set();

  async getAvailableSkills(): Promise<UnifiedSkill[]> {
    // Agents are the primary "skill" in OpenCode
    return this.agents
      .filter((agent) => !agent.hidden)
      .map((agent) => this.fromNativeAgent(agent))
      .filter(Boolean) as UnifiedSkill[];
  }

  async getActiveSkills(): Promise<UnifiedSkill[]> {
    if (!this.activeAgent) return [];
    const agent = this.agents.find((a) => a.name === this.activeAgent);
    if (!agent) return [];
    const unified = this.fromNativeAgent(agent);
    return unified ? [unified] : [];
  }

  async enableSkill(skillId: string): Promise<void> {
    const agentName = this.extractAgentName(skillId);
    if (agentName) {
      this.enabledAgents.add(agentName);
    }
  }

  async disableSkill(skillId: string): Promise<void> {
    const agentName = this.extractAgentName(skillId);
    if (agentName) {
      this.enabledAgents.delete(agentName);
    }
  }

  async isSkillEnabled(skillId: string): Promise<boolean> {
    const agentName = this.extractAgentName(skillId);
    if (!agentName) return false;
    
    // Check if agent exists
    const agent = this.agents.find((a) => a.name === agentName);
    if (!agent || agent.hidden) return false;
    
    // Check if explicitly disabled or uses default enabled state
    if (this.enabledAgents.has(agentName)) return true;
    return !this.enabledAgents.has(`!${agentName}`); // Not explicitly disabled
  }

  toNativeSkill(unified: UnifiedSkill): OpenCodeAgent | null {
    if (!unified.engines.opencode) return null;

    const agentData = unified.engines.opencode;
    const agentName = agentData.agent || unified.name;

    return {
      name: agentName,
      description: unified.description,
      mode: "interactive", // Default mode
      native: true,
      hidden: false,
    };
  }

  fromNativeAgent(native: unknown): UnifiedSkill | null {
    if (!this.isOpenCodeAgent(native)) return null;

    const agent = native as OpenCodeAgent;
    const engineData: OpenCodeSkillData = {
      native: true,
      agent: agent.name,
      provider: agent.modelProviderId || undefined,
    };

    const unified: UnifiedSkill = {
      id: `opencode:${agent.name}`,
      name: agent.name,
      description: agent.description || `OpenCode agent: ${agent.name}`,
      category: this.inferAgentCategory(agent),
      engines: { opencode: engineData },
      enabled: !agent.hidden,
      scope: "workspace",
      icon: this.getAgentIcon(agent),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Register in global registry
    skillRegistry.addSkill(unified);
    return unified;
  }

  fromNativeCommand(command: OpenCodeCommand): UnifiedSkill | null {
    if (!command.name || command.subtask) return null; // Skip subtask commands

    const engineData: OpenCodeSkillData = {
      native: true,
      command: command.name,
      agent: command.agent || undefined,
    };

    const unified: UnifiedSkill = {
      id: `opencode:cmd:${command.name}`,
      name: command.name,
      description: command.description || `Command: ${command.name}`,
      category: "custom",
      engines: { opencode: engineData },
      enabled: true,
      scope: "workspace",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return unified;
  }

  async refresh(): Promise<void> {
    this.enabledAgents.clear();
  }

  /**
   * Update from OpenCode runtime catalog.
   */
  updateFromCatalog(agents: OpenCodeAgent[], commands: OpenCodeCommand[], activeAgent?: string): void {
    this.agents = agents;
    this.commands = commands;
    this.activeAgent = activeAgent || null;

    // Register agents
    for (const agent of agents) {
      if (!agent.hidden) {
        this.fromNativeAgent(agent);
      }
    }

    // Register non-subtask commands
    for (const command of commands) {
      if (!command.subtask) {
        const unified = this.fromNativeCommand(command);
        if (unified) {
          skillRegistry.addSkill(unified);
        }
      }
    }
  }

  /**
   * Set the active agent.
   */
  setActiveAgent(agentName: string | null): void {
    this.activeAgent = agentName;
  }

  /**
   * Get agent icon based on name/mode.
   */
  private getAgentIcon(agent: OpenCodeAgent): string {
    const name = agent.name.toLowerCase();
    const mode = agent.mode.toLowerCase();

    if (name.includes("build") || mode.includes("build")) return "🔨";
    if (name.includes("plan")) return "📋";
    if (name.includes("code")) return "💻";
    if (name.includes("review")) return "👀";
    if (name.includes("test")) return "🧪";
    if (name.includes("debug")) return "🐛";
    if (name.includes("refactor")) return "♻️";
    if (name.includes("doc")) return "📝";

    return "🤖"; // Default robot
  }

  /**
   * Infer category from agent name/mode.
   */
  private inferAgentCategory(agent: OpenCodeAgent): "frontend" | "backend" | "data" | "devops" | "security" | "testing" | "custom" {
    const name = `${agent.name} ${agent.mode}`.toLowerCase();

    if (name.includes("build") || name.includes("code")) return "backend";
    if (name.includes("test")) return "testing";
    if (name.includes("review")) return "custom"; // Code review
    if (name.includes("security")) return "security";
    if (name.includes("deploy") || name.includes("devops")) return "devops";
    if (name.includes("plan")) return "custom"; // Planning

    return "custom";
  }

  /**
   * Extract agent name from skill ID.
   */
  private extractAgentName(skillId: string): string | null {
    if (skillId.startsWith("opencode:")) {
      const parts = skillId.split(":");
      if (parts[1] === "cmd") return null; // It's a command, not an agent
      return parts[1];
    }
    return null;
  }

  private isOpenCodeAgent(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const agent = value as Record<string, unknown>;
    return (
      typeof agent.name === "string" &&
      typeof agent.mode === "string" &&
      typeof agent.native === "boolean"
    );
  }
}

/**
 * Singleton instance.
 */
export const openCodeAgentsAdapter = new OpenCodeAgentsAdapter();
