# TASK-2: Investigar e Habilitar Plan Mode para OpenCode

## 📋 Descrição
Investigar se o OpenCode suporta Plan Mode e tomar a decisão de habilitá-lo ou não baseado na capacidade real.

## 🎯 Objetivo
Determinar se OpenCode pode ter Plan Mode e implementar a solução apropriada.

## 📁 Arquivos a Modificar
- `src/components/chat/ChatPanel.tsx` (se habilitado)
- `src/components/chat/engineCapabilities.ts` (possível)

## 🔧 Tarefas Específicas

### 2.1 Investigar Documentação OpenCode
1. Buscar na web ou codebase por "plan" mode no OpenCode
2. Verificar se existe agent "plan" no `OpenCodeRuntimeCatalog`
3. Verificar se existe flag `--plan` ou similar

### 2.2 Analisar Código Existente
Buscar no codebase:
```bash
grep -r "planMode" /tmp/panes/src/components/chat/
grep -r "isOpenCodeEngine" /tmp/panes/src/components/chat/
```

Analisar:
- `ChatPanel.tsx` linha ~1889: gating de planMode para OpenCode
- `ChatPanel.tsx` linha ~3669: `activePlanMode = planMode && !isOpenCodeEngine`

### 2.3 Decidir Abordagem

**Se OpenCode SUPORTA Plan Mode:**
1. Remover lógica de gating `!isOpenCodeEngine`
2. Mapear `activePlanMode` para flag do OpenCode
3. Adicionar indicador visual de Plan Mode ativo

**Se OpenCode NÃO SUPORTA Plan Mode:**
1. Manter gating (comportamento atual)
2. Adicionar tooltip explicativo: "Plan Mode requires Codex engine"
3. Sugerir alternar para Codex quando usuário tenta usar

### 2.4 Implementar Solução

Se habilitado:
```typescript
// Em ChatPanel.tsx
const activePlanMode = planMode; // Remover !isOpenCodeEngine
```

Se não habilitado:
```typescript
// Adicionar indicador visual
{selectedEngineId === 'opencode' && (
  <Tooltip title="Plan Mode requires Codex engine">
    <PlanModeToggle disabled={true} />
  </Tooltip>
)}
```

## ✅ Critérios de Verificação

1. Se suportado: Plan Mode funciona com OpenCode
2. Se não suportado: UI mostra indicador de indisponibilidade
3. Comportamento consistente entre engines

## 📝 Commits Sugeridos
- `fix: enable plan mode for opencode` (se suportado)
- `docs: document plan mode limitation for opencode` (se não suportado)

## ⏱️ Estimativa: 2 horas (principalmente investigação)
