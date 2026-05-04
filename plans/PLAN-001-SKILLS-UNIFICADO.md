# Plano 001: Skills Unificado entre Providers

## Problema
- **Codex** tem skills nativas (`CodexSkill[]`) com UI no `CodexRuntimePicker`
- **OpenCode** NÃO tem conceito de skills
- **Claude** não tem skills explícitas
- Usuários não têm acesso unificado a skills independente do engine

## Solução
Criar arquitetura de **Skills Unificada** que:
1. Agrega skills de todos os engines
2. Mostra UI consistente (`SkillsPanel`)
3. Funciona como botão lateral no chat
4. Permite ativar/desativar skills por engine

---

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                     UnifiedSkillsProvider                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ CodexSkillsAdapter│  │OpenCodeSkillsAdapter│ │ClaudeSkillsAdapter│ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                ▼                                 │
│                   ┌─────────────────────┐                       │
│                   │   skillRegistry     │                       │
│                   │   Map<string, Skill>│                       │
│                   └──────────┬──────────┘                       │
│                              │                                   │
│           ┌─────────────────┼─────────────────┐                 │
│           ▼                 ▼                 ▼                 │
│    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│    │SkillsPanel  │  │SkillsPicker │  │ useSkills() │          │
│    │ (sidebar)   │  │  (modal)    │  │   hook      │          │
│    └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Arquivos

```
src/components/skills/
├── SkillsPanel.tsx           # Painel lateral (sidebar)
├── SkillsPicker.tsx          # Modal popover para seleção
├── SkillCard.tsx             # Card de skill individual
├── SkillCategoryNav.tsx      # Navegação por categoria
├── UnifiedSkillsProvider.tsx # Context provider
├── useUnifiedSkills.ts       # Hook principal
└── types.ts                  # Tipos unificados

src/lib/skills/
├── skillRegistry.ts          # Registro central
├── adapters/
│   ├── codexAdapter.ts       # CodexSkill[] → UnifiedSkill[]
│   ├── openCodeAdapter.ts    # OpenCode → UnifiedSkill
│   └── claudeAdapter.ts      # Claude → UnifiedSkill
└── store.ts                  # Persistência
```

---

## Tipo Unificado

```typescript
// src/components/skills/types.ts

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
  // OpenCode não tem skills, então mapeamos:
  // - Commands → skills
  // - Agents → skills especializadas
  command?: string;     // /command-name
  agent?: string;       // agent-name
  provider?: string;    // provider que suporta
}

export interface ClaudeSkillData {
  // Claude pode usar instructions como "skills"
  instruction?: string;
  promptTemplate?: string;
}
```

---

## Tarefas

### Fase 1: Infraestrutura (core)

- [ ] **1.1** Criar `src/components/skills/types.ts` com `UnifiedSkill`, `SkillCategory`
- [ ] **1.2** Criar `src/lib/skills/skillRegistry.ts` com `SkillRegistry` class
- [ ] **1.3** Implementar `addSkill()`, `removeSkill()`, `getSkill()`, `getSkillsForEngine()`
- [ ] **1.4** Criar `src/lib/skills/store.ts` com persistência (localStorage/DB)

### Fase 2: Adapters

- [ ] **2.1** Criar `src/lib/skills/adapters/codexAdapter.ts`
  - Converter `CodexSkill[]` → `UnifiedSkill[]`
  - Mapear `scope` → `scope`
  - Extrair `name`, `path`, `description`
- [ ] **2.2** Criar `src/lib/skills/adapters/openCodeAdapter.ts`
  - Mapear `OpenCodeCommand` → `UnifiedSkill` (com flag `isCommand=true`)
  - Mapear `OpenCodeAgent` → `UnifiedSkill` (com flag `isAgent=true`)
  - Criar skills padrão (build, plan)
- [ ] **2.3** Criar `src/lib/skills/adapters/claudeAdapter.ts`
  - Claude não tem skills nativas — criar empty adapter
  - Permitir que usuário crie "skills" como templates

### Fase 3: Hooks e Context

- [ ] **3.1** Criar `UnifiedSkillsProvider.tsx`
  - Provider que agrega todos os adapters
  - Estado de skills habilitados
  - Funções de toggle, add, remove
- [ ] **3.2** Criar hook `useUnifiedSkills(engineId)`
  - `skills`: lista de skills filtradas por engine
  - `toggleSkill(skillId, engineId)`
  - `isEnabled(skillId, engineId)`
  - `activateSkill(skillId)` — para passar para submit

### Fase 4: UI - SkillsPanel

- [ ] **4.1** Criar `SkillCard.tsx`
  ```
  ┌────────────────────────────────────┐
  │ 🔧 react-dev         [toggle]     │
  │ React development helpers          │
  │ Codex · OpenCode · Claude         │
  │ [frontend] [enabled]              │
  └────────────────────────────────────┘
  ```
- [ ] **4.2** Criar `SkillsPanel.tsx` (sidebar)
  - Filtro por categoria (tabs)
  - Lista de SkillCards
  - Botão "Add Custom Skill"
  - Busca
- [ ] **4.3** Integrar `SkillsPanel` no `ChatPanel` como botão lateral
  - Adicionar botão `[💎 Skills]` na toolbar
  - Abrir `SkillsPanel` como drawer/dock

### Fase 5: UI - SkillsPicker (opcional modal)

- [ ] **5.1** Criar `SkillCategoryNav.tsx` com tabs/categorias
- [ ] **5.2** Criar `SkillsPicker.tsx` como popover/modal
- [ ] **5.3** Permitir seleção rápida de skills durante conversa

### Fase 6: Integração com ChatPanel

- [ ] **6.1** Adicionar botão `Skills` na `chat-toolbar`
- [ ] **6.2** Ao ativar skill, passar para submit:
  ```typescript
  submitMessage({
    content: inputValue,
    skills: activeSkills,  // ← aqui
    engineId,
    modelId,
  })
  ```
- [ ] **6.3** Mostrar indicator de skill ativo no composer
  - Badge/chip "react-dev" ao lado do model

### Fase 7: Persistência e Sync

- [ ] **7.1** Salvar estado de skills no `thread.runtime`
- [ ] **7.2** Sync com `SkillsStore` (localStorage)
- [ ] **7.3** Permitir export/import de skills

---

## Duração Estimada

| Fase | Complexidade | Tempo |
|------|-------------|-------|
| Fase 1 | Média | 2-3h |
| Fase 2 | Alta | 3-4h |
| Fase 3 | Média | 2h |
| Fase 4 | Alta | 4-5h |
| Fase 5 | Média | 2h |
| Fase 6 | Alta | 3h |
| Fase 7 | Média | 2h |
| **Total** | — | **18-21h** |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|-------------|---------|-----------|
| Codex adapter pode mudar API | Média | Alto | Versionar adapter |
| OpenCode não tem skills nativas | Alta | Médio | Documentar limitações |
| Complexidade de estado | Média | Médio | Usar Zustand como outros |
| Performance com muitas skills | Baixa | Médio | Virtualizar lista |

---

## Dependências

- `src/types.ts` — já existente
- `src/components/chat/ChatPanel.tsx` — precisa adicionar botão
- `src/store/` — verificar se há store existente para usar padrão

---

## Verificação

1. Compilar sem erros: `npm run build`
2. Skills do Codex aparecem corretamente
3. OpenCode commands aparecem como skills
4. Toggle funciona e persiste
5. Skills aparecem no submit
6. UI responsiva e acessível
