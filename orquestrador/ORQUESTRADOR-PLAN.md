# 🎼 ORQUESTRADOR — PLANO DE IMPLEMENTAÇÃO MAESTRO

## Visão Geral

Este documento coordena a execução paralela de 6 tarefas de implementação, delegando para subagentes e garantindo que todas as correções sejam implementadas corretamente.

## 📋 Tarefas e Dependências

```
TASK-1 (Reasoning Effort) ──────────────────────────────┐
    │                                                   │
    ├──────────────────┐                               │
    │                  │                               │
    ▼                  ▼                               ▼
TASK-2              TASK-3                           TASK-99
(Plan Mode)     (Skills Fase 1)                      (Verificação)
    │                  │                               ▲
    │                  │                               │
    │                  ▼                               │
    │            TASK-4 ──────────────────────────────┤
    │        (Skills Adapters)                        │
    │                  │                               │
    │                  ▼                               │
    │            TASK-5 ──────────────────────────────┤
    │        (Skills UI)                              │
    │                  │                               │
    │                  ▼                               │
    │            TASK-6 ──────────────────────────────┘
    │        (Skills Integração)
```

## 🚀 Ordem de Execução

### Batch 1 (Paralelo)
- **TASK-1**: Corrigir Reasoning Effort para OpenCode
- **TASK-2**: Investigar Plan Mode para OpenCode

### Batch 2 (Após Batch 1)
- **TASK-3**: Skills Unificado - Infraestrutura

### Batch 3 (Após TASK-3)
- **TASK-4**: Skills Unificado - Adapters

### Batch 4 (Após TASK-4)
- **TASK-5**: Skills Unificado - UI

### Batch 5 (Após TASK-5)
- **TASK-6**: Skills Unificado - Integração

### Batch 6 (Final)
- **TASK-99**: Verificação Final

---

## 📊 Status Dashboard

| Task | Status | Agent | Priority |
|------|--------|-------|----------|
| TASK-1 | ⏳ Pending | Subagente-1 | CRÍTICA |
| TASK-2 | ⏳ Pending | Subagente-2 | ALTA |
| TASK-3 | ⏳ Pending | Subagente-3 | ALTA |
| TASK-4 | ⏳ Pending | Subagente-4 | ALTA |
| TASK-5 | ⏳ Pending | Subagente-5 | MÉDIA |
| TASK-6 | ⏳ Pending | Subagente-6 | MÉDIA |
| TASK-99 | ⏳ Pending | Orquestrador | FINAL |

---

## 📁 Estrutura de Arquivos do Orquestrador

```
/tmp/panes/orquestrador/
├── ORQUESTRADOR-PLAN.md          # Este arquivo
├── REGRAS-SUBAGENTES.md          # Regras para subagentes
├── tasks/
│   ├── TASK-1-REASONING-EFFORT.md
│   ├── TASK-2-PLAN-MODE.md
│   ├── TASK-3-SKILLS-FASE1.md
│   ├── TASK-4-SKILLS-FASE2.md
│   ├── TASK-5-SKILLS-FASE3-4.md
│   ├── TASK-6-SKILLS-FASE6-7.md
│   └── TASK-99-VERIFICACAO.md
└── reports/
    └── (relatórios dos agentes)
```

---

## 🔧 Como Executar

### 1. Verificar Prerequisites
```bash
cd /tmp/panes
git status
npm run type-check 2>&1 | tail -5
```

### 2. Criar Branch de Trabalho
```bash
git checkout -b impl/skills-unificado
```

### 3. Executar Tarefas
```bash
# Batch 1 - Paralelo
# Subagente-1: TASK-1
# Subagente-2: TASK-2

# Batch 2 - Sequencial
# Subagente-3: TASK-3

# Batch 3 - Sequencial
# Subagente-4: TASK-4

# Batch 4 - Sequencial
# Subagente-5: TASK-5

# Batch 5 - Sequencial
# Subagente-6: TASK-6

# Batch 6 - Final
# Orquestrador: TASK-99
```

---

## 📝 Regras de Commit

Cada subagente deve seguir:
```
<tipo>(<escopo>): <descrição>

Tipos: feat, fix, refactor, test, docs, chore
Escopo: skills, reasoning, plan-mode, <outro>
```

Exemplos:
- `fix(reasoning): add reasoning effort support for OpenAI o1`
- `feat(skills): add unified skill types and registry`
- `fix(plan-mode): enable plan mode for opencode engine`

---

## 🚨 Critérios de Bloqueio

Se um subagente encontrar:
1. **Arquivo não encontrado**: Reportar imediatamente ao orquestrador
2. **Conflito de merge**: Pausar e reportar
3. **Erro de tipo inesperado**: Documentar e propor solução
4. **Necessita modificação em arquivo não permitido**: Pausar e esperar aprovação

---

## ✅ Verificação de Cada Tarefa

Cada tarefa deve ser verificada antes de prosseguir:

1. [ ] `npx tsc --noEmit` passa
2. [ ] `npm run lint` passa (warnings OK)
3. [ ] `npm run test -- --run` passa
4. [ ] Commits feitos com mensagens significativas
5. [ ] Report enviado ao orquestrador

---

## 📊 Métricas de Sucesso

- **Tarefas Completas**: 6/6
- **Testes Passando**: 100%
- **TypeScript Sem Erros**: 100%
- **Lint Sem Erros**: 100%
- **Commits Significativos**: Mínimo 10

---

## 🎯 Resultado Esperado

Ao final da execução:
1. ✅ OpenCode mostra reasoning effort para modelos suportados
2. ✅ Plan Mode para OpenCode verificado e implementado
3. ✅ Sistema de Skills Unificado funcionando
4. ✅ Botão de Skills na toolbar do ChatPanel
5. ✅ Painel de Skills mostrando skills por engine
6. ✅ Skills podem ser toggladas e persistem

---

*Orquestrador: Bruno | Data: 2026-05-03*
