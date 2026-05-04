// ============================================================
// useSkills - Hook React para gerenciar skills no UI
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { skillsService } from './skillsService';
import { Skill, SkillCategory, SkillProvider, SkillsPreferences } from './types';

interface UseSkillsReturn {
  // Dados
  allSkills: Skill[];
  skillsByCategory: Record<SkillCategory, Skill[]>;
  enabledSkillsByCategory: Record<SkillCategory, Skill[]>;
  activeSkillsForProvider: (provider: SkillProvider) => Skill[];
  
  // UI State
  selectedTab: SkillCategory;
  setSelectedTab: (tab: SkillCategory) => void;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  
  // Ações
  toggleSkill: (id: string) => void;
  isSkillEnabled: (id: string) => boolean;
  
  // Counts
  totalCount: number;
  enabledCount: number;
  getCountByCategory: (category: SkillCategory) => { total: number; enabled: number };
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredSkillsByCategory: Record<SkillCategory, Skill[]>;
  
  // Loading
  isLoading: boolean;
  error: string | null;
}

export function useSkills(initialTab?: SkillCategory): UseSkillsReturn {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selectedTab, setSelectedTabState] = useState<SkillCategory>(
    initialTab || skillsService.getLastTab()
  );
  const [isPanelOpen, setPanelOpenState] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // Carregar skills
  // ============================================================
  
  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Implementar chamada real ao backend
      // Por enquanto simula dados para desenvolvimento
      const results = await skillsService.scanAllProviders();
      const skills = results.flatMap(r => r.skills);
      setAllSkills(skills);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar skills');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
    
    // Subscribe a mudanças
    const unsubscribe = skillsService.onChange(() => {
      setAllSkills(skillsService.getAllSkills());
    });
    
    return unsubscribe;
  }, [loadSkills]);

  // ============================================================
  // Skills por categoria
  // ============================================================

  const skillsByCategory = useMemo(() => {
    const categories: SkillCategory[] = ['opencode', 'codex', 'claude', 'custom'];
    const result = {} as Record<SkillCategory, Skill[]>;
    
    for (const cat of categories) {
      result[cat] = allSkills.filter(s => s.category === cat);
    }
    
    return result;
  }, [allSkills]);

  const enabledSkillsByCategory = useMemo(() => {
    const categories: SkillCategory[] = ['opencode', 'codex', 'claude', 'custom'];
    const result = {} as Record<SkillCategory, Skill[]>;
    
    for (const cat of categories) {
      result[cat] = allSkills.filter(s => s.category === cat && s.enabled);
    }
    
    return result;
  }, [allSkills]);

  const activeSkillsForProvider = useCallback((provider: SkillProvider): Skill[] => {
    const categoryMap: Record<SkillProvider, SkillCategory> = {
      opencode: 'opencode',
      codex: 'codex',
      claude: 'claude',
      custom: 'custom',
    };
    
    const category = categoryMap[provider];
    return allSkills.filter(s => s.category === category && s.enabled);
  }, [allSkills]);

  // ============================================================
  // Search
  // ============================================================

  const filteredSkillsByCategory = useMemo(() => {
    if (!searchQuery.trim()) return skillsByCategory;
    
    const query = searchQuery.toLowerCase();
    const categories: SkillCategory[] = ['opencode', 'codex', 'claude', 'custom'];
    const result = {} as Record<SkillCategory, Skill[]>;
    
    for (const cat of categories) {
      result[cat] = skillsByCategory[cat].filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [skillsByCategory, searchQuery]);

  // ============================================================
  // Counts
  // ============================================================

  const totalCount = allSkills.length;
  
  const enabledCount = allSkills.filter(s => s.enabled).length;
  
  const getCountByCategory = useCallback((category: SkillCategory) => {
    const skills = skillsByCategory[category] || [];
    return {
      total: skills.length,
      enabled: skills.filter(s => s.enabled).length,
    };
  }, [skillsByCategory]);

  // ============================================================
  // Ações
  // ============================================================

  const setSelectedTab = useCallback((tab: SkillCategory) => {
    setSelectedTabState(tab);
    skillsService.setLastTab(tab);
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
  }, []);

  const toggleSkill = useCallback((id: string) => {
    skillsService.toggleSkill(id);
  }, []);

  const isSkillEnabled = useCallback((id: string) => {
    return skillsService.isSkillEnabled(id);
  }, []);

  // ============================================================
  // Retorno
  // ============================================================

  return {
    // Dados
    allSkills,
    skillsByCategory,
    enabledSkillsByCategory,
    activeSkillsForProvider,
    
    // UI State
    selectedTab,
    setSelectedTab,
    isPanelOpen,
    setPanelOpen,
    
    // Ações
    toggleSkill,
    isSkillEnabled,
    
    // Counts
    totalCount,
    enabledCount,
    getCountByCategory,
    
    // Search
    searchQuery,
    setSearchQuery,
    filteredSkillsByCategory,
    
    // Loading
    isLoading,
    error,
  };
}
