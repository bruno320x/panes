# Plano 003: Habilitar Plan Mode para OpenCode

## Problema
Plan Mode está **explicitamente desabilitado** para OpenCode:

```typescript
// ChatPanel.tsx:1889
if (selectedEngineId === "opencode" && planMode) {
  setPlanMode(false);  // ← Forçado OFF
}

// ChatPanel.tsx:3669
const activePlanMode = planMode && !isOpenCodeEngine;  // ← Lógica de gating
```

## Análise

### O que é Plan Mode?
Plan Mode é um modo onde o agent:
1. Analisa a tarefa
2. Cria um plano de steps
3. Pede confirmação antes de executar
4. Executa step by step

### OpenCode Suporta Plan Mode?
Precisa verificar:
1. Se o OpenCode CLI/API suporta modo de planejamento
2. Se existe agent "plan" ou flag `--plan`

```bash
# Possível comando OpenCode:
opencode --plan "implementar feature X"
# ou
opencode --agent plan "implementar feature X"
```

### Se OpenCode NÃO Suporta
Se OpenCode não tem Plan Mode nativo:
- **Opção A**: Não mostrar UI de Plan Mode para OpenCode (comportamento atual)
- **Opção B**: Emular comagent "plan" (se existir)
- **Opção C**: Criar fallback que usa model reasoning

---

## Tarefas

### Fase 1: Verificar Capability (1h)

- [ ] **1.1** Consultar documentação/código do OpenCode sobre plan mode
- [ ] **1.2** Verificar se existe agent "plan" no `OpenCodeRuntimeCatalog`
- [ ] **1.3** Testar manualmente com OpenCode CLI se possível

### Fase 2: Decidir Abordagem

**Se OpenCode suporta:**
- [ ] **2.1** Remover lógica de gating `!isOpenCodeEngine`
- [ ] **2.2** Mapear `activePlanMode` para flag do OpenCode
- [ ] **2.3** Testar fluxo completo

**Se OpenCode NÃO suporta:**
- [ ] **2.1** Manter gating (comportamento atual)
- [ ] **2.2** Adicionar tooltip/indicator: "Plan Mode requires Codex"
- [ ] **2.3** Documentar limitação

### Fase 3: UI Improvements

- [ ] **3.1** Adicionar indicator visual quando feature não disponível
- [ ] **3.2** Tooltip explicando por que desabilitado
- [ ] **3.3** Suggestion: "Switch to Codex for Plan Mode"

---

## Duração Estimada

| Fase | Tempo |
|------|-------|
| Verificação | 1h |
| Decisão | 30 min |
| Implementação | 2h |
| **Total** | **3.5h** |

---

## Arquivos a Modificar

- `src/components/chat/ChatPanel.tsx` — linhas 1889, 3669
- Opcional: `src/components/chat/PlanModeToggle.tsx` (se existir)

---

## Verificação

1. Selecionar OpenCode engine
2. Verificar se UI mostra que Plan Mode não está disponível
3. Se suportado: ativar Plan Mode e ver se funciona
4. Se não suportado: ver tooltip de "requires Codex"
