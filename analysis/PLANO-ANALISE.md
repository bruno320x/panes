# Panes — Plano Completo de Análise do Sistema

> **Objetivo:** Análise profunda de todo o sistema Panes para identificar integrações, más implementações, bugs, melhorias e qualidade UI/UX.

**Stack:** Tauri 2 + Rust (backend) + React 19 + TypeScript (frontend) + Vite
**Ferramentas:** Graphify (grafo de conhecimento), Serena (análise semântica de código), Context7 (docs)

---

## Estrutura do Projeto

### Frontend (`src/`)
| Módulo | Arquivos | Responsabilidade |
|---|---|---|
| `components/chat/` | ~25 arquivos | Chat com AI (Codex, OpenCode, Claude), composer, model picker |
| `components/editor/` | 7 arquivos | CodeMirror editor, file explorer, git diff viewer |
| `components/git/` | 10 arquivos | Branches, commits, changes, stash, worktrees, remotes |
| `components/terminal/` | 2 arquivos | Terminal panel (xterm.js via Tauri) |
| `components/layout/` | 1 arquivo | ThreeColumnLayout |
| `components/sidebar/` | 2 arquivos | Sidebar navigation |
| `components/workspace/` | 6 arquivos | Workspace management, settings, startup |
| `components/onboarding/` | 3 arquivos | Onboarding wizard, harness panel |
| `components/shared/` | 12 arquivos | Error boundary, command palette, modals, toast |
| `stores/` | 18 arquivos | Zustand stores (chat, engine, file, git, terminal, workspace, UI) |
| `lib/` | ~30 arquivos | IPC, clipboard, formatters, file references, terminal utils |
| `workers/` | 5 arquivos | Web workers (diff parser, markdown parser) |
| `i18n/` | 14 arquivos | Internacionalização (en, pt-BR) |

### Backend (`src-tauri/src/`)
| Módulo | Arquivos | Responsabilidade |
|---|---|---|
| `commands/` | 12 arquivos | Tauri IPC commands (app, chat, engines, files, git, harness, power, setup, terminal, threads, workspace) |
| `config/` | 2 arquivos | App configuration management |
| `db/` | 5 arquivos | SQLite database (actions, messages, threads, workspaces, migrations) |
| `engines/` | 8 arquivos | AI engines (Claude sidecar, Codex protocol/transport, OpenCode, API direct, events) |
| `git/` | 6 arquivos | Git operations (repo, multi-repo, worktree, watcher, CLI fallback) |
| `power/` | 4 arquivos | Power management (macOS, monitor) |
| `sidecars/` | 5 arquivos | Claude agent sidecar (Node.js) |
| `terminal/` | 2 arquivos | Terminal management, OSC notifications |

---

## Planos de Análise por Subagente (11 análises paralelas)

### Análise 1: Backend Rust
**Subagente:** `backend-rust-analyst`
**Foco:** Arquitetura, padrões, erros, segurança no código Rust
- `src-tauri/src/lib.rs`, `main.rs`, `state.rs`, `models.rs`
- Todos os módulos em `commands/`, `config/`, `db/`, `engines/`, `git/`, `power/`, `terminal/`
- `Cargo.toml` para dependências e configuração

### Análise 2: Frontend Architecture
**Subagente:** `frontend-arch-analyst`
**Foco:** Arquitetura React, padrões de estado, componentes
- Stores (`src/stores/`) — Zustand patterns, state management
- `App.tsx`, `main.tsx` — Entry points, routing
- `types.ts` — Type definitions
- `lib/` — Utilities organization

### Análise 3: Engine Integration (AI Agents)
**Subagente:** `engine-integration-analyst`
**Foco:** Integração dos engines de AI (Codex, OpenCode, Claude)
- `src-tauri/src/engines/` — Backend engines
- `src/components/chat/` — Frontend chat components
- `src/stores/chatStore.ts`, `engineStore.ts` — State management
- `src/lib/ipc.ts` — IPC communication
- `src-tauri/src/commands/chat.rs`, `engines.rs` — Backend commands

### Análise 4: Git System
**Subagente:** `git-system-analyst`
**Foco:** Integração Git completa (frontend + backend)
- `src-tauri/src/git/` — Backend git operations
- `src/components/git/` — Frontend git UI
- `src/stores/gitStore.ts` — Git state management
- `src/lib/commandPaletteGit.ts` — Git command palette

### Análise 5: Terminal System
**Subagente:** `terminal-system-analyst`
**Foco:** Terminal emulation, performance, integração
- `src-tauri/src/terminal/` — Backend terminal
- `src/components/terminal/` — Frontend terminal
- `src/stores/terminalStore.ts` — Terminal state
- `src/lib/terminal*.ts` — Terminal utilities

### Análise 6: Database & Persistence
**Subagente:** `database-analyst`
**Foco:** Schema, migrations, queries, performance
- `src-tauri/src/db/` — Database module
- `src-tauri/src/db/migrations/` — Migrations
- Store persistence patterns

### Análise 7: UI/UX Analysis
**Subagente:** `ui-ux-analyst`
**Foco:** Experiência do usuário, acessibilidade, design system
- `src/components/layout/` — Layout system
- `src/components/sidebar/` — Navigation
- `src/components/shared/` — Shared components
- `src/components/onboarding/` — Onboarding flow
- `src/globals.css` — Styling
- `src/i18n/` — Internationalization

### Análise 8: Security & Permissions
**Subagente:** `security-analyst`
**Foco:** Segurança, permissões, tratamento de dados sensíveis
- `src-tauri/src/commands/` — Command permissions
- `src/components/chat/PermissionPicker.tsx` — Permission UI
- `src/components/chat/toolInputApproval.ts` — Tool approval
- `src/lib/clipboard.ts` — Clipboard operations
- `src-tauri/src/power/` — Power management

### Análise 9: Performance & Build
**Subagente:** `performance-analyst`
**Foco:** Performance, build system, otimização
- `vite.config.ts` — Vite configuration
- `package.json` — Dependencies
- `src-tauri/Cargo.toml` — Rust dependencies
- `src/workers/` — Web workers
- `src/lib/perfTelemetry.ts` — Performance telemetry

### Análise 10: Cross-Module Integration
**Subagente:** `integration-analyst`
**Foco:** Integração entre módulos, comunicação IPC, fluxo de dados
- `src/lib/ipc.ts` — IPC layer
- `src-tauri/src/lib.rs` — Tauri setup
- `src-tauri/src/state.rs` — Shared state
- Grafo Graphify para dependências entre módulos

### Análise 11: Executive Summary
**Subagente:** `executive-summary-analyst`
**Foco:** Síntese de todas as análises, recomendações prioritizadas
- Consome output das análises 1-10
- Gera relatório executivo final

---

## Fluxo de Execução

```
┌─────────────────────────────────────────────────┐
│              ORQUESTRADOR (Eu)                   │
│  1. Cria estrutura de pastas                    │
│  2. Lança subagentes 1-10 em PARALELO           │
│  3. Coleta resultados                           │
│  4. Lança subagente 11 (síntese)                │
│  5. Apresenta relatório final                   │
└───────────────┬─────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┐
    ▼           ▼           ▼           ▼
 [Rust]     [Frontend]  [Engines]   [Git]
 [Terminal] [DB]        [UI/UX]     [Security]
 [Perf]     [Integration]
    │           │           │           │
    └───────────┼───────────┘           │
                ▼                       │
         [Executive Summary] ◄──────────┘
```

**Cada subagente salva seu relatório em:** `/tmp/panes/analysis/NN-nome/RELATORIO.md`
**Relatório final em:** `/tmp/panes/analysis/11-EXECUTIVE-SUMMARY/RELATORIO.md`
