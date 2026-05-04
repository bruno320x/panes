# TASK-1: Corrigir Reasoning Effort para OpenCode

## 📋 Descrição
Corrigir o bug em `openCodeProviderConnectUtils.ts` onde `supportedReasoningEfforts: []` está hardcoded para todos os modelos OpenCode, impedindo que usuários vejam as opções de reasoning effort.

## 🎯 Objetivo
Quando um modelo OpenAI (o1, o3, o4-mini, etc.) for selecionado no OpenCode, o ModelPicker deve mostrar as opções de reasoning effort (Low, Medium, High).

## 📁 Arquivo Principal
- `src/components/chat/openCodeProviderConnectUtils.ts` (linhas 53-66)

## 📁 Arquivo de Teste
- `src/components/chat/openCodeProviderConnectUtils.test.ts`

## 🔧 Tarefas Específicas

### 1.1 Criar Mapa de Modelos com Reasoning Support
Criar constante `REASONING_MODEL_MAP`:
```typescript
// Modelos que suportam reasoning effort
const REASONING_MODELS: Record<string, string[]> = {
  openai: ['o1', 'o1-mini', 'o1-preview', 'o3', 'o3-mini', 'o4-mini', 'o4'],
  anthropic: ['claude-sonnet-4-7', 'claude-opus-4-5'], // se aplicável
  // Adicionar outros providers conforme documentação
};
```

### 1.2 Modificar syntheticModel()
Modificar a função `syntheticModel()` para aceitar reasoning support:
```typescript
function syntheticModel(
  providerId: string,
  modelId: string,
  displayName: string,
  supportsReasoning: boolean = false
): EngineModel {
  return {
    id: `${providerId}/${modelId}`,
    displayName,
    description: "OpenCode model",
    hidden: false,
    isDefault: false,
    inputModalities: ["text"],
    attachmentModalities: [],
    supportsPersonality: false,
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: supportsReasoning
      ? [
          { reasoningEffort: "low", description: "Fast" },
          { reasoningEffort: "medium", description: "Balanced" },
          { reasoningEffort: "high", description: "Deep" },
        ]
      : [],
  };
}
```

### 1.3 Criar Função Helper
```typescript
function supportsReasoningEffort(providerId: string, modelId: string): boolean {
  const models = REASONING_MODELS[providerId.toLowerCase()];
  if (!models) return false;
  return models.some((m) =>
    modelId.toLowerCase().includes(m.toLowerCase())
  );
}
```

### 1.4 Atualizar buildProviderCatalog()
Onde `syntheticModel()` é chamada, passar o flag de reasoning:
```typescript
syntheticModel(
  providerId,
  model.id,
  model.name,
  supportsReasoningEffort(providerId, model.id)  // ← novo parâmetro
)
```

### 1.5 Atualizar Testes
Em `openCodeProviderConnectUtils.test.ts`:
- Adicionar teste: "deve retornar supportedReasoningEfforts para modelos o1"
- Adicionar teste: "deve retornar array vazio para modelos sem reasoning"

## ✅ Critérios de Verificação

1. `npm run type-check` passa
2. `npm run test` passa
3. Compilação produz `supportedReasoningEfforts` não vazio para o1/o3

## 📝 Commits Sugeridos
- `fix: add reasoning effort support for OpenAI o1/o3 models`
- `test: add tests for reasoning effort detection`

## ⏱️ Estimativa: 2-3 horas
