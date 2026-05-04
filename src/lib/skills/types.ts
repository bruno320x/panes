// ============================================================
// Tipos para o Sistema de Skills Unificado (v2 - Simplificado)
// ============================================================

/**
 * Providers de skill suportados
 */
export type SkillProvider = 'opencode' | 'codex' | 'claude' | 'custom';

/**
 * Categoria de skill (ordem de prioridade visual)
 */
export type SkillCategory = 
  | 'opencode'   // Skills nativas do OpenCode
  | 'codex'      // Skills nativas do Codex
  | 'claude'     // Skills nativas do Claude
  | 'custom';    // Skills customizadas do usuário (.skills/)

/**
 * Representa uma skill individual
 */
export interface Skill {
  id: string;              // unique id (provider:slug)
  name: string;            // nome da skill (do frontmatter ou nome da pasta)
  description: string;      // descrição (do frontmatter)
  provider: SkillProvider;  // qual engine é owner
  category: SkillCategory; // categoria para tabs
  path: string;            // caminho completo para o arquivo SKILL.md
  isNative: boolean;        // true = skill nativa do provider
  enabled: boolean;         // false = desativada pelo usuário
  license?: string;         // do frontmatter (opcional)
  compatibility?: string;   // do frontmatter (opcional)
  metadata?: Record<string, string>; // do frontmatter (opcional)
}

/**
 * Preferências do usuário para skills
 * Salvas em localStorage
 */
export interface SkillsPreferences {
  disabledSkills: string[]; // IDs das skills desativadas
  lastTab?: SkillCategory;  // última tab selecionada
}

/**
 * Estrutura de skill lida do frontmatter YAML
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

/**
 * Resultado do scan de uma pasta de skills
 */
export interface ScanResult {
  provider: SkillProvider;
  category: SkillCategory;
  skills: Skill[];
  error?: string;
}

/**
 * Paths padrão para cada provider
 */
export const SKILL_PATHS: Record<SkillProvider, string[]> = {
  opencode: [
    '.opencode/skills',
    '~/.config/opencode/skills',
  ],
  codex: [
    '.codex/skills',
    '.claude/skills',  // Codex é compatível com formato Claude
  ],
  claude: [
    '.claude/skills',
  ],
  custom: [
    '.skills',
    '.agents/skills',
  ],
};

/**
 * Label para cada provider
 */
export const PROVIDER_LABELS: Record<SkillProvider, string> = {
  opencode: 'OpenCode',
  codex: 'Codex',
  claude: 'Claude',
  custom: 'Custom',
};

/**
 * Ícones para cada provider (emoji/texto)
 */
export const PROVIDER_ICONS: Record<SkillProvider, string> = {
  opencode: '🔧',
  codex: '⚡',
  claude: '🧠',
  custom: '✨',
};
