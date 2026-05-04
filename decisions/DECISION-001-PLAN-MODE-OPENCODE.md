# Decisão Técnica: Plan Mode para OpenCode

**Data:** 2026-05-03  
**Decisor:** Orquestrador (Hermes Agent)  
**Status:** DECIDIDO

---

## Análise

### Código Atual

```typescript
// ChatPanel.tsx:3669
const activePlanMode = planMode && !isOpenCodeEngine;

// ChatPanel.tsx:1889
if (selectedEngineId === "opencode" && planMode) {
  setPlanMode(false);
}
```

### EngineCapabilities

```typescript
// engineCapabilities.ts
const OPENCODE_CAPABILITIES: EngineCapabilities = {
  permissionModes: ["ask", "allow", "deny"],
  sandboxModes: [],  // ← Empty - sem sandbox
  approvalDecisions: ["accept", "decline", "cancel", "accept_for_session"],
};
```

**Observação:** Não há campo `supportsPlan` em `EngineCapabilities`.

---

## Decisão

### ❌ OpenCode NÃO Suporta Plan Mode

**Justificativa:**
1. OpenCode não tem conceito nativo de "Plan Mode" como Codex
2. O OpenCode CLI não expõe flag `--plan` ou similar
3. O agent "plan" no OpenCode é diferente do Plan Mode do Codex
4. Hardcoded como desabilitado em múltiplos lugares

### Ações Tomadas

1. **Manter gating atual** - comportamento existente preservado
2. **Documentar limitação** - neste arquivo
3. **Sugerir UX improvement** - adicionar tooltip quando usuário tentar usar

---

## Recomendação UX

Adicionar indicator visual quando OpenCode está selecionado e usuário tenta acessar Plan Mode:

```tsx
// No futuro, quando engineCapabilities_expanded existir:
{selectedEngineId === 'opencode' && (
  <Tooltip content="Plan Mode requires Codex engine">
    <button disabled className="plan-mode-btn plan-mode-disabled">
      Plan Mode
    </button>
  </Tooltip>
)}
```

---

## Alternativas Consideradas

1. **Remover gating** - Rejeitado: OpenCode não suporta
2. **Mapear para agent "plan"** - Rejeitado: Conceitos diferentes
3. **Criar emulação via model reasoning** - Rejeitado: Complexo demais para v1

---

## Próximos Passos (Opcional)

Se no futuro OpenCode suportar Plan Mode:
1. Adicionar `supportsPlan: boolean` em `EngineCapabilities`
2. Remover lógica de gating
3. Mapear para flag correta do OpenCode
