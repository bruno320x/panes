# Análise Comparativa: Codex vs OpenCode — Ferramentas, Skills e Capabilities

> **Data:** Domingo, 03 de Maio de 2026  
> **Escopo:** Análise minuciosa de todas as ferramentas, skills e capabilities por engine  
> **Objetivo:** Identificar gaps e propor arquitetura unificada para skills

---

## 1. Resumo Executivo

| Categoria | Codex | OpenCode | Gap |
|-----------|-------|----------|-----|
| **Skills** | ✅ Nativo (CodexSkill) | ❌ Não existe | CRÍTICO |
| **MCP Servers** | ✅ Diagnóstico completo | ✅ Lista básica (status) | Parcial |
| **Plugins** | ✅ Marketplace | ❌ Não existe | CRÍTICO |
| **Apps/External** | ✅ CodexApp list | ❌ Não existe | CRÍTICO |
| **Sandbox Modes** | 3 modos | ❌ Nenhum (empty array) | CRÍTICO |
| **Permission Modes** | 4 modos | 3 modos | Parcial |
| **Experimental Features** | ✅ Suportado | ❌ Não existe | CRÍTICO |
| **Collaboration Modes** | ✅ Suportado | ❌ Não existe | CRÍTICO |
| **Slash Commands** | 10+ comandos | 3+ comandos dinâmicos | Alto |

---

## 2. Codex — Ferramentas e Capabilities

### 2.1 CodexRuntimePicker (793 linhas)

O Codex tem um picker completo (`CodexRuntimePicker`) com seções:

```
┌─────────────────────────────────────────────┐
│ Runtime Configuration                        │
├─────────────────────────────────────────────┤
│ Status: Current                             │
│ Fetched: 2026-05-03 10:30                   │
├─────────────────────────────────────────────┤
│ [Account]                                   │
│   Provider: OpenAI                          │
│   Auth Mode: OAuth                          │
│   Email: user@example.com                   │
│   Plan: Pro                                 │
├─────────────────────────────────────────────┤
│ [Config]                                    │
│   Model: claude-sonnet-4-7                  │
│   Service Tier: Auto (Fast/Flex)            │
│   Sandbox Mode: Read Only                  │
│   Web Search: Enabled                       │
│   Profile: Default                          │
│   Layers: [base:1.0] [+code:2.0]           │
├─────────────────────────────────────────────┤
│ [Modes]                                     │
│   chips: [live, multi-agent]                │
├─────────────────────────────────────────────┤
│ [Features] ⚡ Experimental                  │
│   chips: [workspace agent, ...]             │
├─────────────────────────────────────────────┤
│ [Skills] 🎯                                 │
│   chips: [react-dev, python-data, ...]     │  ← CodexSkill[]
├─────────────────────────────────────────────┤
│ [Apps] 🚀                                   │
│   chips: [vscode, chrome, ...]             │  ← CodexApp[]
├─────────────────────────────────────────────┤
│ [Plugins] 📦 Marketplace                    │
│   ┌─────────────────────────────────────┐  │
│   │ Claude Code Plugins                 │  │
│   │ Path: ~/.config/...                 │  │
│   │ • Database Client (capabilities:...) │  │
│   │ • API Tester                        │  │
│   └─────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│ [MCP Servers] 🔌                            │
│   ┌─────────────────────────────────────┐  │
│   │ filesystem: tools:12 resources:5    │  │
│   │ github: tools:8 resources:3         │  │
│   └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 2.2 Tipos Codex Relacionados

```typescript
// types.ts
interface CodexSkill {
  name: string;      // "react-dev"
  path: string;      // "/path/to/skill"
  description: string;
  enabled: boolean;
  scope: string;     // "global", "repo", "workspace"
}

interface CodexApp {
  id: string;
  name: string;      // "vscode"
  description?: string;
  isEnabled: boolean;
  isAccessible: boolean;
}

interface CodexPlugin {
  id: string;
  name: string;
  enabled: boolean;
  installed: boolean;
  capabilities: string[];  // e.g. ["edit", "bash", "read"]
  developerName?: string;
  description?: string;
}

interface CodexMcpServer {
  name: string;
  authStatus: string;
  toolCount: number;
  resourceCount: number;
  resourceTemplateCount: number;
}
```

### 2.3 CodexProtocolDiagnostics

O Codex tem um sistema de diagnóstico completo:

```typescript
interface CodexProtocolDiagnostics {
  stale: boolean;
  fetchedAt: string;
  account: CodexAccountState;
  config: CodexConfigState;
  collaborationModes: string[];
  experimentalFeatures: { name: string; stage: string; enabled: boolean }[];
  skills: CodexSkill[];
  apps: CodexApp[];
  mcpServers: CodexMcpServer[];
  pluginMarketplaces: CodexPluginMarketplace[];
  methodAvailability: CodexMethodAvailability[];
  // ... events e warnings
}
```

---

## 3. OpenCode — Ferramentas e Capabilities

### 3.1 O que OpenCode Tem

```typescript
// OpenCodeRuntimeCatalog
interface OpenCodeRuntimeCatalog {
  agents: OpenCodeAgent[];
  commands: OpenCodeCommand[];
  mcpServers: OpenCodeMcpServer[];
  defaultAgent?: string | null;
}

interface OpenCodeAgent {
  name: string;           // "build", "plan"
  description?: string | null;
  mode: string;           // "primary", "all"
  native: boolean;
  hidden: boolean;
  modelProviderId?: string | null;
  modelId?: string | null;
  variant?: string | null;
  steps?: number | null;
}

interface OpenCodeCommand {
  name: string;           // "agents", "commands", "sessions"
  description?: string | null;
  agent?: string | null;
  model?: string | null;
  source?: string | null;
  subtask: boolean;
  hints: string[];
}

interface OpenCodeMcpServer {
  name: string;
  status: string;
  detail?: string | null;
  raw: unknown;
}
```

### 3.2 O que OpenCode NÃO Tem

| Item | Codex | OpenCode | Impacto |
|------|-------|----------|---------|
| **Skills** | CodexSkill[] com scope, path, enabled | ❌ Não existe | ALTO |
| **Apps** | CodexApp[] com isEnabled, isAccessible | ❌ Não existe | ALTO |
| **Plugins** | CodexPluginMarketplace com capabilities | ❌ Não existe | ALTO |
| **Diagnostics** | CodexProtocolDiagnostics completo | ❌ Não existe | CRÍTICO |
| **Experimental Features** | Lista com stage, enabled | ❌ Não existe | MÉDIO |
| **Collaboration Modes** | Lista de modos | ❌ Não existe | MÉDIO |
| **Layers/Versioning** | Config com layers source:version | ❌ Não existe | MÉDIO |
| **Method Availability** | Status de cada método | ❌ Não existe | MÉDIO |

### 3.3 OpenCodeAgentPicker (181 linhas)

O OpenCode tem um picker de agentes (`OpenCodeAgentPicker`) que é **muito mais simples**:

```
┌─────────────────────────────────────┐
│ Select Agent                        │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🤖 build              [SELECT] │ │  ← Agent nativo
│ │ Default coding agent           │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 📋 plan               [SELECT] │ │  ← Agent nativo
│ │ Planning agent (when available)│ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🔧 custom-agent      [SELECT] │ │  ← Agent custom
│ │ Description...                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Problemas identificados:**
1. Sem ícone detalhado por tipo de agent
2. Sem indication de capabilities
3. Sem indicator de enabled/disabled state
4. Não mostra model provider info

---

## 4. Comparação Detalhada de Features

### 4.1 Skills

| Aspecto | Codex | OpenCode |
|---------|-------|----------|
| **Estrutura** | `CodexSkill` | ❌ Não existe |
| **Propriedades** | name, path, description, enabled, scope | — |
| **Escopos** | global, repo, workspace | — |
| **UI** | `CodexRuntimePicker` → seção "Skills" | ❌ Nenhuma |
| **Interação** | Chip list com scope | — |
| **Carregamento** | Via `useCodexDiagnostics()` | — |

**Veredicto:** OpenCode **NÃO TEM SKILLS**. Isso é um gap crítico porque:
- Skills permitem estender capacidades do agent
- Codex usa skills como primeiro-class citizen
- Não há equivalente no OpenCode

### 4.2 MCP Servers

| Aspecto | Codex | OpenCode |
|---------|-------|----------|
| **Estrutura** | `CodexMcpServer` | `OpenCodeMcpServer` |
| **Propriedades** | name, authStatus, toolCount, resourceCount, resourceTemplateCount | name, status, detail, raw |
| **UI** | Detalhada com tool/resource counts | Básica com apenas status |
| **Auth Status** | ✅ Suportado | ❌ Não exposto |
| **Tool Count** | ✅ Suportado | ❌ Não exposto |

**Veredicto:** OpenCode tem MCP básico, mas **NÃO EXPÕE** informações detalhadas.

### 4.3 Sandbox Modes

| Engine | sandboxModes | Count |
|--------|--------------|-------|
| **Codex** | `["read-only", "workspace-write", "danger-full-access"]` | 3 |
| **Claude** | `["read-only", "workspace-write"]` | 2 |
| **OpenCode** | `[]` (empty) | 0 |

**Veredicto:** OpenCode **NÃO TEM SANDBOX**. Isso é crítico para segurança.

### 4.4 Permission Modes

| Engine | permissionModes |
|--------|-----------------|
| **Codex** | `["untrusted", "on-failure", "on-request", "never"]` |
| **Claude** | `["restricted", "standard", "trusted"]` |
| **OpenCode** | `["ask", "allow", "deny"]` |

**Veredicto:** Modelos diferentes (sem correspondência direta).

---

## 5. Lacunas Críticas Identificadas

### 5.1 🔴 Skills — Gap Mais Crítico

O Codex implementa skills como:

```typescript
// Como skills são usadas no Codex:
const codexSkills = useCodexSkills(); // CodexSkill[]

// Renderizadas no CodexRuntimePicker:
<Section title="Skills">
  <ChipList items={skillLabels} />
</Section>

// Onde skillLabels = skills.map(skill => `${skill.name} · ${skill.scope}`)
```

**OpenCode NÃO TEM:**
- Conceito de skill
- UI para listar skills
- Escopo (global/repo/workspace)
- Habilitar/desabilitar skills

### 5.2 🔴 Diagnostics — Sistema Inexistente

O Codex tem `CodexProtocolDiagnostics` que agrega:
- Account state
- Config state
- Skills, Apps, MCP servers
- Method availability
- Events/warnings

OpenCode tem `OpenCodeRuntimeCatalog` que é **muito mais limitado**:
- Só agents, commands, mcpServers
- Sem account info
- Sem config detalhado
- Sem diagnostics

### 5.3 🟠 Experimental Features — Não Suportado

```typescript
// Codex
experimentalFeatures: { name: string; stage: string; enabled: boolean }[]

// Renderizado como chips no RuntimePicker
```

### 5.4 🟠 Collaboration Modes — Não Suportado

```typescript
// Codex
collaborationModes: string[]  // e.g. ["live", "multi-agent"]
```

---

## 6. Proposta: Arquitetura Unificada de Skills

### 6.1 Visão Geral

Criar uma camada abstrata de **Skills Unificada** que funcione para todos os engines:

```
┌─────────────────────────────────────────────────────────────┐
│                    SkillsPanel (UI)                         │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [All] [Enabled] [By Engine]                           │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │ │
│  │ │ 🔧 react    │ │ 🐍 python   │ │ 📊 data    │       │ │
│  │ │ Codex+Open  │ │ Codex Only  │ │ OpenCode    │       │ │
│  │ │ [✓]         │ │ [✓]         │ │ [ ]         │       │ │
│  │ └─────────────┘ └─────────────┘ └─────────────┘       │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Tipo Unificado Proposto

```typescript
interface UnifiedSkill {
  id: string;                    // UUID único
  name: string;                 // "react-dev"
  description: string;          // "React development helpers"
  category: SkillCategory;      // "frontend" | "backend" | "data" | "devops"
  
  // Engine compatibility
  engines: {
    codex?: CodexSkillCompat;
    opencode?: OpenCodeSkillCompat;
    claude?: ClaudeSkillCompat;
  };
  
  // Metadata
  scope: "global" | "workspace" | "repo";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CodexSkillCompat {
  path: string;                // Path para skill Codex
  scope: string;
  native: true;
}

interface OpenCodeSkillCompat {
  // Skills podem ser mapeadas como commands ou agents
  command?: string;            // Mapeia para /command
  agent?: string;              // Mapeia para agent específico
  provider?: string;           // Provider que suporta skill
}

interface ClaudeSkillCompat {
  instruction?: string;        // Instruções customizadas
  prompt_template?: string;   // Template de prompt
}
```

### 6.3 Componentes Propostos

```
src/components/skills/
├── SkillsPanel.tsx           # Painel lateral de skills
├── SkillsPicker.tsx          # Seletor de skills (modal/popover)
├── SkillCard.tsx             # Card individual de skill
├── SkillCategoryNav.tsx      # Navegação por categoria
├── UnifiedSkillsProvider.tsx # Context provider para skills
├── useUnifiedSkills.ts       # Hook para acessar skills
└── types.ts                  # Tipos unificados
```

### 6.4 Arquitetura de Dados

```typescript
// skillRegistry.ts — registro central de skills
const skillRegistry = new Map<string, UnifiedSkill>();

// Função para descobrir skills por engine
function getSkillsForEngine(engineId: string): UnifiedSkill[] {
  return Array.from(skillRegistry.values())
    .filter(skill => skill.engines[engineId] !== undefined && skill.enabled);
}

// Função para verificar se engine suporta skill
function isSkillSupportedForEngine(skillId: string, engineId: string): boolean {
  const skill = skillRegistry.get(skillId);
  return skill?.engines[engineId] !== undefined;
}
```

### 6.5 Persistência

```typescript
// Local storage ou banco de dados
interface SkillsStore {
  skills: UnifiedSkill[];
  engineOverrides: Record<string, Record<string, boolean>>; // engineId -> skillId -> enabled
  lastSync: string;
}
```

### 6.6 UI Sugerida — SkillsPanel

```tsx
// SkillsPanel.tsx
function SkillsPanel({ engineId }: { engineId: string }) {
  const { skills, toggleSkill, loading } = useUnifiedSkills(engineId);
  
  return (
    <aside className="skills-panel">
      <header>
        <h3>Skills</h3>
        <span className="skill-count">{skills.length}</span>
      </header>
      
      <div className="skills-filter">
        <button active={filter === 'all'}>All</button>
        <button active={filter === 'enabled'}>Enabled</button>
        <button active={filter === 'this-engine'}>Current Engine</button>
      </div>
      
      <div className="skills-list">
        {skills.map(skill => (
          <SkillCard
            key={skill.id}
            skill={skill}
            enabled={isEnabled(skill.id, engineId)}
            onToggle={() => toggleSkill(skill.id, engineId)}
            engineSupports={skill.engines[engineId] !== undefined}
          />
        ))}
      </div>
      
      <button className="add-skill-btn">
        <PlusIcon /> Add Skill
      </button>
    </aside>
  );
}
```

---

## 7. Planos de Implementação

### Plano A: Skills Unificado (Recomendado)

**Fase 1: Infraestrutura**
1. Criar `UnifiedSkill` tipo em `src/types.ts`
2. Criar `skillRegistry` em `src/lib/skillRegistry.ts`
3. Criar `useUnifiedSkills` hook
4. Criar `SkillsStore` para persistência

**Fase 2: Adapters**
1. Criar `codexSkillsAdapter` — converte CodexSkill[] para UnifiedSkill[]
2. Criar `openCodeSkillsAdapter` — mapeia OpenCode commands/agents para skills
3. Criar `claudeSkillsAdapter` — converte Claude configs para UnifiedSkill[]

**Fase 3: UI**
1. Criar `SkillsPanel.tsx` (painel lateral)
2. Criar `SkillCard.tsx`
3. Criar `SkillsPicker.tsx` (modal)
4. Integrar no ChatPanel como botão lateral

**Fase 4: Integração**
1. Hook `onSkillActivated(skill)` no ChatPanel
2. Passar skills para engine via submit
3. Mostrar indicator de skill ativo

### Plano B: Melhorar OpenCode Runtime Catalog (Alternativo)

Se Skills Unificado for muito complexo:

1. **Estender `OpenCodeRuntimeCatalog`** para incluir skills
2. **Adicionar `OpenCodeDiagnostics`** similar ao Codex
3. **Criar `OpenCodeRuntimePicker`** similar ao CodexRuntimePicker

---

## 8. Conclusão

### Gaps Críticos
1. **Skills**: OpenCode não tem nenhum conceito de skills
2. **Diagnostics**: Falta sistema de diagnóstico completo
3. **Sandbox**: OpenCode não tem sandbox modes
4. **Plugins**: Codex tem marketplace, OpenCode não tem

### Recomendação
Implementar **Skills Unificado** que:
1. Abstrai diferenças entre engines
2. Permite mesmo UI para todos
3. Mapeia capabilities nativas quando existem
4. Cria interface consistente

### Priorização
1. 🔴 **Alta**: Skills unificado (demanda do usuário)
2. 🟠 **Média**: Estender OpenCodeMcpServer com mais info
3. 🟠 **Média**: Adicionar sandbox modes para OpenCode
4. 🟡 **Baixa**: Collaboration modes (se OpenCode suportar)

---

*Relatório 12 — Complemento aos relatórios 03 e 07*
