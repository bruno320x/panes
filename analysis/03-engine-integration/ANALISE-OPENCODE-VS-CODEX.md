# Análise Detalhada: OpenCode vs Codex vs Claude — Diferenças Visuais e Funcionais

> **Data:** Domingo, 03 de Maio de 2026  
> **Escopo:** Análise comparativa de UI/UX e funcionalidades entre os 3 engines  
> **Origem:** Complemento ao relatório 03-engine-integration

---

## 1. Comparativo de Componentes UI por Engine

### 1.1 Pickers e Painéis Específicos

| Componente | Codex | Claude | OpenCode | Arquivo |
|------------|-------|--------|----------|---------|
| **Agent Picker** | ❌ | ❌ | ✅ | `OpenCodeAgentPicker.tsx` (181 linhas) |
| **Config Picker** | ✅ (429 linhas) | ❌ | ❌ | `CodexConfigPicker.tsx` |
| **Runtime Picker** | ✅ (793 linhas) | ❌ | ❌ | `CodexRuntimePicker.tsx` |
| **Review Picker** | ✅ (301 linhas) | ❌ | ❌ | `CodexReviewPicker.tsx` |
| **Thread Picker** | ✅ (576 linhas) | ❌ | ❌ | `CodexThreadPicker.tsx` |
| **Provider Connect Modal** | ❌ | ❌ | ✅ (33KB) | `OpenCodeProviderConnectModal.tsx` |
| **Model Picker** | ✅ | ✅ | ✅ | `ModelPicker.tsx` (com lógica branching) |

**Conclusão:** Codex tem **4 pickers especializados** enquanto OpenCode tem apenas **1** (Agent Picker). Claude não tem nenhum picker específico — usa interface genérica.

---

## 2. Slash Commands por Engine

### 2.1 Codex — 10 Slash Commands

| Comando | Descrição | UI |
|---------|-----------|-----|
| `/review` | Code review | `CodexReviewPicker` |
| `/fork` | Fork thread | `CodexThreadPicker` |
| `/rollback` | Rollback thread | `CodexThreadPicker` |
| `/compact` | Compact thread | `CodexThreadPicker` |
| `/fast` | Service tier fast | `CodexConfigPicker` |
| `/personality` | Personality selection | `CodexConfigPicker` |
| `/skills` | Skills picker | `CodexRuntimePicker` |
| `/MCP` | MCP servers | `CodexRuntimePicker` |
| `/experimental` | Experimental features | `CodexRuntimePicker` |
| `/compact` | Compact history | `CodexThreadPicker` |

### 2.2 OpenCode — 3 Slash Commands + 3 dinâmicos

| Comando | Descrição | UI |
|---------|-----------|-----|
| `/agents` | Agent selection | `OpenCodeAgentPicker` |
| `/commands` | OpenCode commands | Interface genérica |
| `/sessions` | Session management | Interface genérica |
| *(dinâmicos)* | providers, models | `ModelPicker` |

### 2.3 Claude — 0 Slash Commands

Claude usa interface genérica. Não há comandos específicos.

---

## 3. Features de UI que OpenCode NÃO Tem

### 3.1 ❌ Plan Mode Desabilitado

```typescript
// ChatPanel.tsx:1889
if (selectedEngineId === "opencode" && planMode) {
  setPlanMode(false);
}
```

```typescript
// ChatPanel.tsx:3669
const activePlanMode = planMode && !isOpenCodeEngine;
```

**Problema:** O Plan Mode é explicitamente desabilitado para OpenCode. O botão/feature não aparece visualmente quando OpenCode está selecionado.

### 3.2 ❌ Reasoning Effort

**Codex:**
```typescript
// ModelPicker.tsx:710-711
const efforts = reasoningOptionsForModel(model, engineId);
// Mostra: none, minimal, low, medium, high, xhigh, max
```

**OpenCode:** Não há picker de reasoning effort. O ModelPicker detecta `isOpenCodeEngine` e não mostra as opções de effort.

```typescript
// ModelPicker.tsx - implicitamente não mostra effort para OpenCode
// (baseado na lógica de reasoningOptionsForModel)
```

### 3.3 ❌ Service Tier (Fast/Flex)

**Codex:**
```typescript
// ModelPicker.tsx - service tier picker visível para Codex
// ComposerRuntime.ts:18 - serviceTier: "fast" | "flex" | null
```

**OpenCode:** `serviceTier` é sempre `null`.

```typescript
// composerRuntime.ts
serviceTier:
  selectedEngineId === "codex"
    ? normalizeComposerServiceTier(selectedServiceTier)
    : null,  // ← OpenCode sempre null
```

### 3.4 ❌ Personality

Codex tem seletor de personalidade (`CodexConfigPicker.tsx`). OpenCode não tem.

### 3.5 ❌ Skills

Codex tem `/skills` command e Skills picker no `CodexRuntimePicker`. OpenCode não tem.

### 3.6 ❌ Review, Rollback, Compact

Codex tem `/review`, `/rollback`, `/compact` com interfaces especializadas. OpenCode tem versões simplificadas genéricas.

---

## 4. Features que OpenCode TEM e Outros Não

### 4.1 ✅ Multi-Provider Model Catalog

OpenCode é o **único** engine com:
- Suporte a múltiplos providers (OpenAI, Anthropic, Google, Groq, Ollama, etc.)
- `OpenCodeProviderConnectModal` para OAuth flow
- Seleção hierárquica: Provider → Agent → Model

```typescript
// ModelPicker.tsx:476
function renderOpenCodeProviderTree() {
  // Árvore de providers com modelos aninhados
}
```

### 4.2 ✅ Session Management

OpenCode tem:
- `/sessions` command
- Fork, revert, share, summarize de sessões
- Remote session listing

### 4.3 ✅ Agents Nativos

OpenCode tem agente `build` (default) e `plan` (quando disponível):

```typescript
// OpenCodeAgentPicker.tsx:27-41
function buildAgentOptions(agents: OpenCodeAgent[]): OpenCodeAgent[] {
  const visible = agents.filter(isSelectableAgent);
  if (visible.some((agent) => agent.name === "build")) {
    return visible;
  }
  return [
    {
      name: "build",
      description: null,
      mode: "primary",
      native: true,
      hidden: false,
      // ...
    },
    ...visible,
  ];
}
```

---

## 5. Matriz de Features Visuais/Funcionais

| Feature Visual | Codex | Claude | OpenCode |
|----------------|-------|--------|----------|
| **Model Picker** | ✅ | ✅ | ✅ (com provider tree) |
| **Reasoning Effort Picker** | ✅ | ❌ | ❌ |
| **Service Tier** | ✅ (fast/flex) | ❌ | ❌ |
| **Personality** | ✅ | ❌ | ❌ |
| **Skills Picker** | ✅ | ❌ | ❌ |
| **Review Interface** | ✅ (especializada) | ❌ | ❌ |
| **Rollback Interface** | ✅ (especializada) | ❌ | ❌ |
| **Compact Interface** | ✅ (especializada) | ❌ | ❌ |
| **Thread Management UI** | ✅ (especializada) | ❌ | ❌ |
| **Plan Mode** | ✅ | ❌ | ❌ (desabilitado) |
| **Agent Picker** | ❌ | ❌ | ✅ |
| **Provider Connect Modal** | ❌ | ❌ | ✅ |
| **Multi-Provider Catalog** | ❌ | ❌ | ✅ |
| **Session Management UI** | ❌ | ❌ | ✅ |
| **Slash Commands** | 10 | 0 | 3+ |
| **Permission Picker** | ✅ | ✅ | ✅ |

---

## 6. Problemas de UX Identificados

### 6.1 🔴 Inconsistência de UI

Quando usuário troca de Codex para OpenCode:
- Perde acesso ao **Plan Mode** abruptamente (desabilitado)
- Perde **Reasoning Effort** sem feedback visual claro
- Ganha **Agents**, **Sessions**, **Commands** — mas não há indicação visual de que mudou

### 6.2 🔴 Falta de Feature Parity Visual

O ModelPicker mostra esforço apenas para Codex:

```typescript
// ModelPicker.tsx:615-616
{selectedEffort && reasoningOptionsForModel(currentModel, currentEngine?.id).length > 0 ? (
  <span className="mp-trigger-effort">{shortEffortLabel(t, selectedEffort)}</span>
```

Não há indication visual de que "este modelo não suporta reasoning effort".

### 6.3 🟡 OpenCode Agent Picker Limitado

`OpenCodeAgentPicker.tsx` (181 linhas) é muito menor que os Codex pickers:
- Não tem preview de capabilities do agent
- Não mostra description detalhada
- Não tem ícone além de `Bot` genérico

### 6.4 🟡 Provider Connect Modal Épico

`OpenCodeProviderConnectModal.tsx` tem **33KB** — maior que todos os Codex pickers juntos. Isso sugere que a UI de OAuth é complexa e bem desenvolvida, mas as outras partes do OpenCode são negligenciadas.

---

## 7. Recomendações de UX

### 7.1 Alta Prioridade

1. **Adicionar indicator visual quando features são desabilitadas**
   - Quando OpenCode está ativo, mostrar badge "Plan Mode não disponível"
   - Mostrar tooltip explicando por que reasoning effort não aparece

2. **Unificar a experiência de pickers**
   - Criar base component `EngineFeaturePicker` que abstrai diferenças
   - Mostrar sempre os controles relevantes com estado disabled vs hidden

### 7.2 Média Prioridade

3. **Enriquecer OpenCodeAgentPicker**
   - Adicionar preview de capabilities
   - Mostrar description do agent
   - Adicionar ícones específicos por tipo de agent

4. **Adicionar reasoning effort para OpenCode**
   - Se o modelo subjacente suporta,也应该 mostrar
   - Mapear para opções do OpenCode

### 7.3 Baixa Prioridade

5. **Adicionar Plan Mode para OpenCode**
   - Verificar se OpenCode suporta modo de planejamento
   - Se sim, habilitar

6. **Criar OpenCode Runtime/Config Picker**
   - Para parity com Codex

---

## 8. Conclusão

O OpenCode está **parcialmente integrado** em termos de UI. Ele tem:
- ✅ Sistema de providers e agents (único entre os 3)
- ✅ Session management rico
- ❌ Plan Mode desabilitado
- ❌ Reasoning Effort ausente
- ❌ Service Tier ausente
- ❌ Personality ausente
- ❌ Skills ausente
- ❌ Pickers especializados ausentes

Isso cria uma experiência inconsistente para usuários que alternam entre engines. O Codex é claramente o engine mais desenvolvido em termos de UI, enquanto OpenCode priorizou providers/sessions mas negligenciou controles de comportamento do modelo.

---

*Complemento ao relatório 03-engine-integration — focado em diferenças visuais e de UX.*
