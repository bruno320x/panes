// ============================================================
// SkillsService - Escaneia e gerencia skills de todos os providers
// v2 - Usa comandos Tauri para escanear filesystem
// ============================================================

import { invoke } from '@tauri-apps/api/core';
import { Skill, SkillProvider, SkillCategory, SkillsPreferences, ScanResult, SKILL_PATHS } from './types';

const PREFS_KEY = 'panes_skills_preferences';

// ============================================================
// Tipos para respostas do Tauri
// ============================================================

interface TauriSkillInfo {
  id: string;
  name: string;
  description: string;
  provider: string;
  category: string;
  path: string;
  is_native: boolean;
  enabled: boolean;
  license?: string;
  compatibility?: string;
}

interface TauriScanResult {
  provider: string;
  category: string;
  skills: TauriSkillInfo[];
  error?: string;
}

/**
 * SkillsService - serviço centralizado para gerenciar skills
 */
export class SkillsService {
  private skills: Map<string, Skill> = new Map();
  private preferences: SkillsPreferences = { disabledSkills: [] };
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  constructor() {
    this.loadPreferences();
  }

  // ============================================================
  // Persistência
  // ============================================================

  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        this.preferences = JSON.parse(stored);
        if (!this.preferences.disabledSkills) {
          this.preferences.disabledSkills = [];
        }
      }
    } catch {
      this.preferences = { disabledSkills: [] };
    }
  }

  private savePreferences(): void {
    localStorage.setItem(PREFS_KEY, JSON.stringify(this.preferences));
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => fn());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ============================================================
  // Getters públicos
  // ============================================================

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkillsByCategory(category: SkillCategory): Skill[] {
    return this.getAllSkills().filter(s => s.category === category);
  }

  getEnabledSkills(): Skill[] {
    return this.getAllSkills().filter(s => s.enabled);
  }

  getEnabledSkillsByCategory(category: SkillCategory): Skill[] {
    return this.getEnabledSkills().filter(s => s.category === category);
  }

  getActiveSkillsForProvider(provider: SkillProvider): Skill[] {
    const categoryMap: Record<SkillProvider, SkillCategory> = {
      opencode: 'opencode',
      codex: 'codex',
      claude: 'claude',
      custom: 'custom',
    };
    
    const category = categoryMap[provider];
    return this.getEnabledSkillsByCategory(category);
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  isSkillEnabled(id: string): boolean {
    return !this.preferences.disabledSkills.includes(id);
  }

  getPreferences(): SkillsPreferences {
    return { ...this.preferences };
  }

  getLastTab(): SkillCategory {
    return this.preferences.lastTab || 'custom';
  }

  // ============================================================
  // Ações do usuário
  // ============================================================

  toggleSkill(id: string): void {
    const skill = this.skills.get(id);
    if (!skill || !skill.isNative) return;

    if (this.preferences.disabledSkills.includes(id)) {
      this.preferences.disabledSkills = this.preferences.disabledSkills.filter(s => s !== id);
    } else {
      this.preferences.disabledSkills.push(id);
    }
    
    skill.enabled = !this.preferences.disabledSkills.includes(id);
    this.savePreferences();
  }

  enableSkill(id: string): void {
    if (this.preferences.disabledSkills.includes(id)) {
      this.preferences.disabledSkills = this.preferences.disabledSkills.filter(s => s !== id);
      const skill = this.skills.get(id);
      if (skill) skill.enabled = true;
      this.savePreferences();
    }
  }

  disableSkill(id: string): void {
    if (!this.preferences.disabledSkills.includes(id)) {
      this.preferences.disabledSkills.push(id);
      const skill = this.skills.get(id);
      if (skill) skill.enabled = false;
      this.savePreferences();
    }
  }

  setLastTab(tab: SkillCategory): void {
    this.preferences.lastTab = tab;
    this.savePreferences();
  }

  // ============================================================
  // Scan via Tauri
  // ============================================================

  /**
   * Escaneia skills de um provider específico via Tauri
   */
  async scanProvider(provider: SkillProvider): Promise<ScanResult> {
    try {
      const result = await invoke<TauriScanResult>('scan_skills', { provider });
      return this.convertScanResult(result);
    } catch (error) {
      console.error(`Error scanning ${provider} skills:`, error);
      return {
        provider,
        category: provider,
        skills: [],
        error: String(error),
      };
    }
  }

  /**
   * Escaneia todas as pastas de skills dos providers
   */
  async scanAllProviders(): Promise<ScanResult[]> {
    try {
      const results = await invoke<TauriScanResult[]>('scan_all_skills');
      return results.map(r => this.convertScanResult(r));
    } catch (error) {
      console.error('Error scanning all skills:', error);
      // Fallback: escanear cada um individualmente
      const providers: SkillProvider[] = ['opencode', 'codex', 'claude', 'custom'];
      return Promise.all(providers.map(p => this.scanProvider(p)));
    }
  }

  /**
   * Obtém o conteúdo de uma skill para passar ao engine
   */
  async getSkillContent(path: string): Promise<string> {
    try {
      return await invoke<string>('get_skill_content', { path });
    } catch (error) {
      console.error('Error reading skill content:', error);
      throw error;
    }
  }

  /**
   * Converte resultado do Tauri para formato interno
   */
  private convertScanResult(result: TauriScanResult): ScanResult {
    const skills: Skill[] = result.skills.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      provider: s.provider as SkillProvider,
      category: s.category as SkillCategory,
      path: s.path,
      isNative: s.is_native,
      enabled: !this.preferences.disabledSkills.includes(s.id),
      license: s.license,
      compatibility: s.compatibility,
    }));

    // Adicionar ao map
    for (const skill of skills) {
      this.skills.set(skill.id, skill);
    }

    return {
      provider: result.provider as SkillProvider,
      category: result.category as SkillCategory,
      skills,
      error: result.error,
    };
  }

  // ============================================================
  // utilitários
  // ============================================================

  generateSkillId(provider: SkillProvider, name: string): string {
    return `${provider}:${name.toLowerCase().replace(/\s+/g, '-')}`;
  }

  isValidSkillName(name: string): boolean {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) && 
           name.length >= 1 && 
           name.length <= 64;
  }

  clear(): void {
    this.skills.clear();
    this.notifyListeners();
  }

  /**
   * Atualiza skills de um resultado de scan
   */
  updateFromScanResult(result: ScanResult): void {
    for (const skill of result.skills) {
      this.skills.set(skill.id, {
        ...skill,
        enabled: !this.preferences.disabledSkills.includes(skill.id),
      });
    }
    this.notifyListeners();
  }
}

// Singleton
export const skillsService = new SkillsService();
