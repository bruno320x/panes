# TASK-4: Skills Unificado - Fase 2 (Adapters)

## 📋 Descrição
Criar os adapters que convertem dados específicos de cada engine (Codex, OpenCode, Claude) para o formato Unificado.

## 🎯 Objetivo
Permitir que skills de diferentes engines sejam representadas de forma consistente.

## 📁 Novos Arquivos a Criar

### 1. `src/lib/skills/adapters/codexAdapter.ts`
### 2. `src/lib/skills/adapters/openCodeAdapter.ts`
### 3. `src/lib/skills/adapters/claudeAdapter.ts`
### 4. `src/lib/skills/adapters/index.ts`

## 📁 Arquivos de Referência
- `src/components/chat/CodexRuntimePicker.tsx` (para ver CodexSkill)
- `src/types.ts` (linhas ~578-590 para CodexSkill)
- `src/types.ts` (linhas ~586-652 para OpenCodeRuntimeCatalog)

## 🔧 Tarefas Específicas

### 4.1 CodexAdapter
```typescript
// src/lib/skills/adapters/codexAdapter.ts
import type { CodexSkill } from '../../../types';
import type { UnifiedSkill } from '../../types';

export function adaptCodexSkill(skill: CodexSkill): UnifiedSkill {
  return {
    id: `codex:${skill.name}`,
    name: skill.name,
    description: skill.description,
    category: inferCategory(skill.name), // inferir categoria do nome
    engines: {
      codex: {
        native: true,
        path: skill.path,
        scope: skill.scope,
      },
    },
    enabled: skill.enabled,
    scope: skill.scope as 'global' | 'workspace' | 'repo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function adaptCodexSkills(skills: CodexSkill[]): UnifiedSkill[] {
  return skills.map(adaptCodexSkill);
}
```

### 4.2 OpenCodeAdapter
```typescript
// src/lib/skills/adapters/openCodeAdapter.ts
import type { OpenCodeCommand, OpenCodeAgent } from '../../../types';
import type { UnifiedSkill } from '../../types';

// Comandos OpenCode viram skills
export function adaptOpenCodeCommand(command: OpenCodeCommand): UnifiedSkill {
  return {
    id: `opencode:cmd:${command.name}`,
    name: command.name,
    description: command.description || `OpenCode command: ${command.name}`,
    category: inferCategory(command.name),
    engines: {
      opencode: {
        command: command.name,
        agent: command.agent ?? undefined,
      },
    },
    enabled: true, // comandos sempre habilitados
    scope: 'global',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Agentes OpenCode viram skills especializadas
export function adaptOpenCodeAgent(agent: OpenCodeAgent): UnifiedSkill {
  return {
    id: `opencode:agent:${agent.name}`,
    name: agent.name,
    description: agent.description || `OpenCode agent: ${agent.name}`,
    category: 'custom',
    engines: {
      opencode: {
        agent: agent.name,
        provider: agent.modelProviderId ?? undefined,
      },
    },
    enabled: !agent.hidden,
    scope: 'global',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
```

### 4.3 ClaudeAdapter
```typescript
// src/lib/skills/adapters/claudeAdapter.ts
import type { UnifiedSkill } from '../../types';

// Claude não tem skills nativas, mas podemos criar
// "skills" como templates de instruções
export function createClaudeInstructionSkill(
  name: string,
  instruction: string
): UnifiedSkill {
  return {
    id: `claude:custom:${name}`,
    name,
    description: `Custom instruction: ${name}`,
    category: 'custom',
    engines: {
      claude: {
        instruction,
      },
    },
    enabled: true,
    scope: 'global',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Empty adapter - Claude não tem skills nativas para adaptar
export function adaptClaudeSkills(): UnifiedSkill[] {
  return []; // Placeholder para futura implementação
}
```

### 4.4 Index
```typescript
// src/lib/skills/adapters/index.ts
export { adaptCodexSkill, adaptCodexSkills } from './codexAdapter';
export { adaptOpenCodeCommand, adaptOpenCodeAgent } from './openCodeAdapter';
export { createClaudeInstructionSkill, adaptClaudeSkills } from './claudeAdapter';
```

### 4.5 Função Helper para inferência de categoria
```typescript
function inferCategory(name: string): SkillCategory {
  const lower = name.toLowerCase();
  if (lower.includes('react') || lower.includes('vue') || lower.includes('angular') || lower.includes('css') || lower.includes('html')) {
    return 'frontend';
  }
  if (lower.includes('python') || lower.includes('node') || lower.includes('java') || lower.includes('go') || lower.includes('rust')) {
    return 'backend';
  }
  if (lower.includes('sql') || lower.includes('data') || lower.includes('pandas') || lower.includes('analytics')) {
    return 'data';
  }
  if (lower.includes('docker') || lower.includes('kubernetes') || lower.includes('aws') || lower.includes('ci/cd')) {
    return 'devops';
  }
  if (lower.includes('security') || lower.includes('auth') || lower.includes('encrypt')) {
    return 'security';
  }
  if (lower.includes('test') || lower.includes('jest') || lower.includes('cypress')) {
    return 'testing';
  }
  return 'custom';
}
```

## ✅ Critérios de Verificação

1. Adaptadores convertem corretamente
2. Tipos são inferidos corretamente
3. IDs únicos por engine

## 📝 Commits Sugeridos
- `feat(skills): add codex skill adapter`
- `feat(skills): add opencode command/agent adapter`
- `feat(skills): add claude skill adapter`

## ⏱️ Estimativa: 2-3 horas
