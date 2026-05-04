# 🎯 ORQUESTRADOR — REGRAS E DIRETRIZES PARA SUBAGENTES

## Contexto do Projeto
- **Projeto**: Panes (fork de wygoralves/panes)
- **Stack**: Tauri 2 + React 19 + TypeScript + Rust
- **Diretório**: `/tmp/panes`
- **Branche**: `main` (ou `trunk`)

---

## 📜 REGRAS FUNDAMENTAIS

### 1. Regras de Código

1. **TypeScript First**: Todo código novo deve ser TypeScript com tipos completos
2. **Sem `any`**: Não usar `any` — usar `unknown` ou tipos adequados
3. **ESLint/Prettier**: Respeitar configurações existentes do projeto
4. **Componentes Funccionais**: Usar React functional components com hooks
5. **Zustand Pattern**: Seguir padrão de stores existente se aplicável

### 2. Regras de Arquitetura

1. **Backwards Compatibility**: Não quebrar funcionalidades existentes
2. **Incremental Changes**: Alterações pequenas e incrementais
3. **Feature Flags**: Se necessário, usar feature flags ao invés de remover código
4. **Separation of Concerns**: UI separada de lógica de negócio

### 3. Regras de Git/Commits

1. **Commits Atômicos**: Um commit = uma mudança
2. **Mensagens Significativas**: `feat:`, `fix:`, `refactor:`, `docs:`
3. **Branches**: `fix/reasoning-effort`, `feat/skills-unificado`, etc.
4. **Não commitar**:
   - `node_modules/`
   - `*.log`
   - Configurações pessoais

### 4. Regras de Testes

1. **Testes Unitários**: Para lógicas complexas (reasoningEffort, etc.)
2. **Testes de Componente**: Para UI críticos
3. **Manter testes existentes**: Não remover ou modificar testes sem motivo
4. **Nomenclatura**: `*.test.ts` para unit tests

---

## 📋 ARQUIVOS CRÍTICOS (READ-ONLY se não explicitamente permitido)

### NÃO MODIFICAR (sem aprovação do orquestrador):
- `src/components/chat/ChatPanel.tsx` (muito grande, 6000+ linhas)
- `src/types.ts` (sem consultar orquestrador)
- `src/store/` (sem consultar orquestrador)

### PODEM SER MODIFICADOS:
- `src/components/chat/openCodeProviderConnectUtils.ts`
- `src/components/chat/reasoningEffort.ts`
- `src/components/chat/ModelPicker.tsx` (adições pequenas)
- `src/components/chat/engineCapabilities.ts`
- Criar novos arquivos em `src/components/skills/`
- Criar novos arquivos em `src/lib/skills/`

---

## 🔧 PADRÕES DE IMPLEMENTAÇÃO

### Componentes React
```tsx
// Estrutura padrão
import { useState, useCallback } from 'react';

interface Props {
  title: string;
  onAction: (value: string) => void;
}

export function MyComponent({ title, onAction }: Props) {
  const [value, setValue] = useState('');
  
  const handleSubmit = useCallback(() => {
    if (value.trim()) {
      onAction(value.trim());
    }
  }, [value, onAction]);
  
  return (
    <div className="my-component">
      <h3>{title}</h3>
      {/* implementation */}
    </div>
  );
}
```

### Hooks
```typescript
// Estrutura padrão
export function useMyHook(initialValue: string) {
  const [value, setValue] = useState(initialValue);
  
  const update = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);
  
  return { value, update };
}
```

### Tipos
```typescript
// Em arquivos .ts separados ou no topo do arquivo
export interface MyType {
  id: string;
  name: string;
  enabled: boolean;
}

export type MyUnionType = 'option1' | 'option2' | 'option3';
```

---

## 📁 ESTRUTURA DE DIRETÓRIOS

```
src/components/skills/           # Novos componentes de skills
├── types.ts                     # Tipos unificados
├── SkillsPanel.tsx              # Painel lateral
├── SkillCard.tsx               # Card de skill
└── UnifiedSkillsProvider.tsx   # Context provider

src/lib/skills/                 # Lógica de negócio
├── adapters/
│   ├── codexAdapter.ts
│   ├── openCodeAdapter.ts
│   └── claudeAdapter.ts
└── store.ts
```

---

## ✅ CHECKLIST DE VERIFICAÇÃO (antes de finalizar tarefa)

- [ ] Código compila sem erros (`npm run build` ou `npm run type-check`)
- [ ] TypeScript sem erros (`npx tsc --noEmit`)
- [ ] Lint passa (`npm run lint`)
- [ ] Testes existentes ainda passam
- [ ] Novos testes criados (se aplicável)
- [ ] Commits com mensagens significativas
- [ ] Documentação atualizada (se necessário)

---

## 🚫 PROIBIDO

1. **DELETAR** arquivos sem aprovação
2. **MODIFICAR** configurações de build (vite.config, etc.)
3. **ALTERAR** a estrutura de rotas sem aprovação
4. **REMOVER** features existentes
5. **FAZER** breaking changes na API pública
6. **IGNORAR** erros de TypeScript ou ESLint

---

## 📞 COMUNICAÇÃO COM ORQUESTRADOR

### Quando Reportar:
1. **Erro de Bloco**: Impossível continuar por problema técnico
2. **Dúvida de Arquitetura**: Precisa decisão sobre design
3. **Conflito**: another agent está trabalhando no mesmo arquivo
4. **Bloqueio**: Depends on outra task que não completou

### Formato de Report:
```
## [TASK-X] Status Report

### Completed:
- Item 1
- Item 2

### Blocked:
- Reason: depends on TASK-Y

### Questions:
- Question about X?
```

---

## 🎯 PRIORIDADES DE TAREFA

1. **CRÍTICO**: Corrigir bugs que causam crash
2. **ALTA**: Features marcadas como high priority
3. **MÉDIA**: Melhorias de UX
4. **BAIXA**: Refatorações cosméticas

---

## 📊 CRITÉRIOS DE SUCESSO

Uma tarefa está **COMPLETA** quando:
1. ✅ Código implementado e testado
2. ✅ Compila sem erros
3. ✅ Commits feitos com mensagens significativas
4. ✅ Report enviado ao orquestrador

Uma tarefa está **APROVADA** quando:
1. Code review feito pelo orquestrador
2. Não há comentários pendentes
3. Merge para main/trunk autorizado
