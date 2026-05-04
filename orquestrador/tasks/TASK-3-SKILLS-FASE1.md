# TASK-3: Skills Unificado - Fase 1 (Infraestrutura)

## 📋 Descrição
Criar a infraestrutura base para o sistema de Skills Unificado: tipos, registry e store.

## 🎯 Objetivo
Estabelecer a fundação para que as fases subsequentes possam construir sobre ela.

## 📁 Novos Arquivos a Criar

### 1. `src/components/skills/types.ts`
```typescript
export type SkillCategory = 
  | "frontend" 
  | "backend" 
  | "data" 
  | "devops" 
  | "security" 
  | "testing"
  | "custom";

export interface UnifiedSkill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  
  // Compatibilidade com engines
  engines: {
    codex?: CodexSkillData;
    opencode?: OpenCodeSkillData;
    claude?: ClaudeSkillData;
  };
  
  // Estado
  enabled: boolean;
  scope: "global" | "workspace" | "repo";
  
  // Metadata
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodexSkillData {
  native: true;
  path: string;
  scope: string;
}

export interface OpenCodeSkillData {
  command?: string;
  agent?: string;
  provider?: string;
}

export interface ClaudeSkillData {
  instruction?: string;
  promptTemplate?: string;
}

export type SkillEngine = 'codex' | 'opencode' | 'claude';
```

### 2. `src/lib/skills/skillRegistry.ts`
```typescript
import type { UnifiedSkill, SkillEngine } from '../../components/skills/types';

class SkillRegistry {
  private skills = new Map<string, UnifiedSkill>();
  
  addSkill(skill: UnifiedSkill): void;
  removeSkill(skillId: string): boolean;
  getSkill(skillId: string): UnifiedSkill | undefined;
  getAllSkills(): UnifiedSkill[];
  getSkillsForEngine(engine: SkillEngine): UnifiedSkill[];
  isSkillSupportedForEngine(skillId: string, engine: SkillEngine): boolean;
  updateSkill(skillId: string, updates: Partial<UnifiedSkill>): void;
}

export const skillRegistry = new SkillRegistry();
```

### 3. `src/lib/skills/store.ts`
```typescript
import { skillRegistry } from './skillRegistry';
import type { UnifiedSkill } from '../../components/skills/types';

interface SkillsStore {
  // Estado
  skills: UnifiedSkill[];
  engineOverrides: Record<string, Record<string, boolean>>; // engineId -> skillId -> enabled
  lastSync: string;
  
  // Ações
  addSkill(skill: UnifiedSkill): void;
  removeSkill(skillId: string): void;
  toggleSkill(skillId: string, engineId: string): void;
  isEnabled(skillId: string, engineId: string): boolean;
  getSkillsForEngine(engineId: string): UnifiedSkill[];
  persist(): void;
  hydrate(): void;
}

// Persistência em localStorage
const STORAGE_KEY = 'panes:skills';
```

## 🔧 Tarefas Específicas

### 3.1 Criar `src/components/skills/`
```bash
mkdir -p src/components/skills
mkdir -p src/lib/skills/adapters
```

### 3.2 Implementar `types.ts`
- Definir todos os tipos listados acima
- Exportar `SkillCategory`, `UnifiedSkill`, e todos os tipos de dados por engine

### 3.3 Implementar `skillRegistry.ts`
- Classe `SkillRegistry` com métodos:
  - `addSkill(skill)` - adiciona skill ao registry
  - `removeSkill(skillId)` - remove skill
  - `getSkill(skillId)` - busca skill por ID
  - `getAllSkills()` - lista todas
  - `getSkillsForEngine(engine)` - filtra por engine
  - `isSkillSupportedForEngine(skillId, engine)` - verifica suporte
  - `updateSkill(skillId, updates)` - atualiza skill

### 3.4 Implementar `store.ts`
- Estado: `skills`, `engineOverrides`, `lastSync`
- Ações: `addSkill`, `removeSkill`, `toggleSkill`, `isEnabled`, `getSkillsForEngine`
- Persistência: `persist()` para localStorage, `hydrate()` para carregar

### 3.5 Criar arquivo de índice
```typescript
// src/components/skills/index.ts
export * from './types';
export * from './UnifiedSkillsProvider';
export * from './useUnifiedSkills';
```

## ✅ Critérios de Verificação

1. `npx tsc --noEmit` passa sem erros
2. SkillRegistry funciona em memória
3. Store persiste e hidrata corretamente
4. Tipos exportados corretamente

## 📝 Commits Sugeridos
- `feat(skills): add unified skill types`
- `feat(skills): implement skill registry`
- `feat(skills): implement skills store with persistence`

## ⏱️ Estimativa: 3 horas
