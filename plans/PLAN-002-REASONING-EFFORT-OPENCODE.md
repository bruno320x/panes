# Plano 002: Correção do Reasoning Effort para OpenCode

## Problema
O OpenCode tem `supportedReasoningEfforts: []` (vazio) **hardcoded** em `openCodeProviderConnectUtils.ts`, mesmo quando os modelos subjacentes (ex: OpenAI o1, o3, o4-mini) suportam reasoning effort.

```typescript
// openCodeProviderConnectUtils.ts:63-64
defaultReasoningEffort: "medium",
supportedReasoningEfforts: [],  // ← SEMPRE VAZIO — BUG!
```

## Impacto
- Usuários do OpenCode **não veem** as opções de reasoning effort
- UX inconsistente vs Codex que mostra Low/Medium/High
- Modelos que suportam não expõem a feature

---

## Root Cause

A função `buildProviderCatalog()` não consulta a capacidade real dos modelos:

```typescript
// openCodeProviderConnectUtils.ts
function buildProviderCatalog(...) {
  // Itera modelos mas NÃO busca supportedReasoningEfforts
  for (const model of models) {
    const catalogModel = {
      // ...outros campos
      defaultReasoningEffort: "medium",  // hardcoded
      supportedReasoningEfforts: [],     // hardcoded ← BUG
    };
  }
}
```

---

## Solução

### Abordagem 1: Mapear manualmente (Rápido)

Mapear quais modelos OpenAI/Google/Anthropic suportam reasoning effort:

```typescript
const REASONING_MODELS: Record<string, string[]> = {
  openai: ["o1", "o1-mini", "o1-preview", "o3", "o3-mini", "o4-mini"],
  anthropic: ["claude-sonnet-4-7", "claude-opus-4-5"], // modelos com extended thinking
  google: ["gemini-2.5-pro"], // se suportar
};

// No buildProviderCatalog:
const providerId = /* extrair provider */;
const modelId = /* extrair model id */;
if (REASONING_MODELS[providerId]?.includes(modelId)) {
  supportedReasoningEfforts = [
    { reasoningEffort: "low", description: "Fast" },
    { reasoningEffort: "medium", description: "Balanced" },
    { reasoningEffort: "high", description: "Deep" },
  ];
}
```

### Abordagem 2: Buscar da API do provider (Ideal)

Consultar `/models` da API do provider para obter capabilities reais:

```typescript
async function fetchModelCapabilities(providerId: string, modelId: string) {
  const response = await providerApi.get(`/models/${modelId}`);
  return {
    supportedReasoningEfforts: response.data.reasoning_efforts ?? [],
    // outras capabilities
  };
}
```

---

## Tarefas

### Fase 1: Diagnóstico (30 min)

- [ ] **1.1** Verificar na documentação do OpenCode/CLI quais modelos suportam reasoning effort
- [ ] **1.2** Listar todos os modelos nos providers disponíveis
- [ ] **1.3** Mapear provider → modelos com reasoning

### Fase 2: Implementação (2-3h)

- [ ] **2.1** Criar `REASONING_MODEL_MAP` em `openCodeProviderConnectUtils.ts`
- [ ] **2.2** Modificar `buildProviderCatalog()` para verificar se modelo está no map
- [ ] **2.3** Popular `supportedReasoningEfforts` baseado no map
- [ ] **2.4** Testar com modelo que sabemos suportar (o1, o3)

### Fase 3: Validação (1h)

- [ ] **3.1** Verificar se ModelPicker mostra effort pills para OpenCode
- [ ] **3.2** Testar mudança de effort e ver se reflete no composer
- [ ] **3.3** Verificar se persiste no thread state

---

## Arquivos a Modificar

```
src/components/chat/openCodeProviderConnectUtils.ts
```

```diff
// Linha ~55-70 (model default)
{
  id: "openai/o1",
  displayName: "o1",
  isDefault: false,
  inputModalities: ["text"],
  attachmentModalities: [],
  supportsPersonality: false,
  defaultReasoningEffort: "medium",
- supportedReasoningEfforts: [],
+ supportedReasoningEfforts: [
+   { reasoningEffort: "low", description: "Fast" },
+   { reasoningEffort: "medium", description: "Balanced" },
+   { reasoningEffort: "high", description: "Deep" },
+ ],
},
```

---

## Duração Estimada

| Fase | Tempo |
|------|-------|
| Diagnóstico | 30 min |
| Implementação | 2-3h |
| Validação | 1h |
| **Total** | **3.5 - 4.5h** |

---

## Verificação

1. Abrir ModelPicker com OpenCode selecionado
2. Selecionar modelo "o1" ou similar
3. Ver se aparecem pills de effort: [Low] [Medium] [High]
4. Selecionar "High" e verificar que aparece no trigger
5. Mudar para "low" e verificar atualização
