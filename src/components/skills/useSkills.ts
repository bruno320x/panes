/**
 * useSkills - Hook principal para acessar o sistema de skills
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  skillRegistry,
  skillsStore,
  codexSkillsAdapter,
  openCodeAgentsAdapter,
  claudePersonasAdapter,
} from "../lib/skills";
import type { UnifiedSkill, SkillEngine } from "../components/skills/types";

/**
 * useSkills - Hook para gerenciar skills
 */
export function useSkills(engineId?: string | null) {
  const [skills, setSkills] = useState<UnifiedSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = skillsStore.subscribe(() => {
      if (engineId) {
        setSkills(skillsStore.getSkillsForEngine(engineId));
      } else {
        setSkills(skillRegistry.getAllSkills());
      }
    });

    // Initial load
    if (engineId) {
      setSkills(skillsStore.getSkillsForEngine(engineId));
    } else {
      setSkills(skillRegistry.getAllSkills());
    }

    return unsubscribe;
  }, [engineId]);

  /**
   * Toggle a skill on/off for the current engine.
   */
  const toggleSkill = useCallback(
    (skillId: string) => {
      if (!engineId) return;
      skillsStore.toggleSkill(skillId, engineId);
    },
    [engineId],
  );

  /**
   * Check if a skill is enabled.
   */
  const isEnabled = useCallback(
    (skillId: string) => {
      if (!engineId) return false;
      return skillsStore.isEnabled(skillId, engineId);
    },
    [engineId],
  );

  /**
   * Get skills by category.
   */
  const byCategory = useMemo(() => {
    const grouped: Record<string, UnifiedSkill[]> = {};
    for (const skill of skills) {
      if (!grouped[skill.category]) {
        grouped[skill.category] = [];
      }
      grouped[skill.category].push(skill);
    }
    return grouped;
  }, [skills]);

  /**
   * Search skills.
   */
  const search = useCallback((query: string) => {
    if (!query.trim()) {
      return skills;
    }
    return skillRegistry.search(query);
  }, [skills]);

  return {
    skills,
    loading,
    error,
    toggleSkill,
    isEnabled,
    byCategory,
    search,
  };
}

/**
 * useSkillAdapter - Hook para acessar o adapter correto para o engine
 */
export function useSkillAdapter(engineId: string | null) {
  return useMemo(() => {
    if (!engineId) return null;

    switch (engineId) {
      case "codex":
        return codexSkillsAdapter;
      case "opencode":
        return openCodeAgentsAdapter;
      case "claude":
        return claudePersonasAdapter;
      default:
        return null;
    }
  }, [engineId]);
}

/**
 * useSkillSelection - Hook para seleção de skills
 */
export function useSkillSelection(engineId: string | null) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((skillId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((skillIds: string[]) => {
    setSelectedIds(new Set(skillIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    toggle,
    selectAll,
    clearSelection,
    isSelected: (id: string) => selectedIds.has(id),
  };
}
