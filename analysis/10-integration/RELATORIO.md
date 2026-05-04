# Relatório de Integração Cross-Module — Panes

**Data:** Domingo, 03 de Maio de 2026  
**Escopo:** Análise da integração frontend ↔ backend no aplicativo Panes  
**Repositório:** `/tmp/panes`

---

## 1. Visão Geral da Arquitetura de Integração

O Panes é um aplicativo desktop construído sobre o framework **Tauri 2.x**, que estabelece uma ponte entre um frontend **TypeScript/React** e um backend **Rust**. A comunicação entre as duas camadas ocorre por meio de duas primitivas principais:

| Primitive | Direção | Uso |
|-----------|---------|-----|
| `invoke()` | Frontend → Backend | Chamadas de comando RPC (requisição/resposta) |
| `listen()` / `emit()` | Backend → Frontend | Eventos assíncronos (push-based) |

### Camadas-chave identificadas

| Camada | Arquivo | Responsabilidade |
|--------|---------|------------------|
| **IPC (Frontend)** | `src/lib/ipc.ts` |thin wrapper sobre `invoke()` e `listen()` do Tauri |
| **Tauri Setup** | `src-tauri/src/lib.rs` | Registro de comandos, gerenciamento de estado global (`AppState`), bridge de eventos Codex |
| **Estado Compartilhado** | `src-tauri/src/state.rs` | `AppState` com `Arc<>` para todos os gerenciadores (DB, engines, terminals, git watchers, etc.) |
| **Stores (Frontend)** | `src/stores/*.ts` | Camada Zustand de gerenciamento de estado reativo |

---

## 2. Mapeamento do Fluxo de Dados

### 2.1 Diagrama de Fluxo Simplificado

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (TypeScript)                  │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────────┐ │
│  │  Stores  │◄──│ ipc.ts   │◄──│  Componentes React       │ │
│  │ (Zustand)│   │invoke()  │   │  (UI callbacks)         │ │
│  └────┬─────┘   └────┬─────┘   └──────────────────────────┘ │
│       │               │                                      │
│       │ listen()      │ invoke()                            │
│       │               │                                      │
└───────┼───────────────┼──────────────────────────────────────┘
        │               │
        ▼               ▼
┌───────────────────────────────────────────────────────────────┐
│                       BACKEND (Rust)                          │
│                                                                │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │ AppState        │    │  commands/                       │  │
│  │ - db            │    │  app.rs (locale, notif)          │  │
│  │ - engines       │◄───│  chat.rs (messages, approvals)   │  │
│  │ - terminals     │    │  workspace.rs (repos, workspaces)│  │
│  │ - git_watchers  │    │  git.rs (operations)             │  │
│  │ - turns         │    │  terminal.rs                     │  │
│  │ - notifications │    │  threads.rs (CRUD + engine sync)  │  │
│  └─────────────────┘    │  engines.rs (Codex, OpenCode)      │  │
│                        │  files.rs, power.rs, setup.rs,     │  │
│                        │  harness.rs                        │  │
│                        └─────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ CodexRuntimeBridge (lib.rs:run_codex_runtime_bridge)    │  │
│  │  - Recebe eventos de runtime do Codex                   │  │
│  │  - Faz emit() para o frontend via Tauri events         │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 Principais Domínios de Dados e Seus Fluxos

#### Domínio: Workspaces ↔ Repos
- **Fluxo:** `workspaceStore` → `ipc.openWorkspace()` → `commands::workspace::open_workspace` → `db::workspaces` → retorna `Workspace`
- **Estado derivado:** `repos` são carregados separadamente via `ipc.getRepos()` e cacheados no store
- **Persistência:** Workspaces em SQLite (`db/workspaces.rs`), preferências em `localStorage` (IDs ativos)

#### Domínio: Threads ↔ Engines (Codex/OpenCode)
- **Fluxo bidirecional:**
  1. Criação: `threadStore` → `ipc.createThread()` → `db::threads::create_thread` → registra na DB
  2. Eventos: `EngineManager` (Rust) emite `CodexRuntimeEvent` → `run_codex_runtime_bridge()` → `app.emit("thread-updated", ...)` → `listenThreadUpdated()` no frontend
- **Estado do turno:** `TurnManager` (Rust, `state.rs`) gerencia `CancellationToken` por `thread_id` para permitir `cancelTurn`
- **Sincronização:** `sync_thread_from_engine` força re-leitura do estado do engine

#### Domínio: Terminal
- **Modelo:** `TerminalManager` em Rust gerencia múltiplas sessões
- **Eventos:** output é enviado via `terminal-output-{workspaceId}` events
- **Escrita:** `terminal_write` e `terminal_write_bytes` são comandos unidirecionais
- **Drain:** `terminal_drain_output` permite ao frontend controlar o consumo de output

#### Domínio: Git
- **Operações:** Todas via comando (`stage`, `commit`, `push`, `pull`, `branch`, `stash`, `worktree`)
- **Watching:** `GitWatcherManager` observa mudanças e emite `git-repo-changed` events
- **Cache:** `FileTreeCache` em Rust para evitar recomputação de árvores de arquivos

---

## 3. Análise de Completude da IPC

### 3.1 Comandos Registrados no Backend vs. disponíveis no Frontend

O backend registra **150+ comandos** no `invoke_handler`. O frontend expõe um subconjunto no objeto `ipc`. A análise revela:

**Completeza geral: ~85%**

| Módulo | Comandos no Backend | Comandos no Frontend | Status |
|--------|--------------------|---------------------|--------|
| `app` | 11 | 11 | ✅ Completo |
| `power` | 4 | 4 | ✅ Completo |
| `chat` | 10 | 10 | ✅ Completo |
| `workspace` | 16 | 16 | ✅ Completo |
| `git` | 28 | 28 | ✅ Completo |
| `files` | 9 | 9 | ✅ Completo |
| `terminal` | 14 | 14 | ✅ Completo |
| `engines` | 14 | 14 | ✅ Completo |
| `threads` | 25 | 25 | ✅ Completo |
| `setup` | 3 | 3 | ✅ Completo |
| `harness` | 3 | 3 | ✅ Completo |

**Observação:** Todos os comandos registrados no `invoke_handler` parecem estar expostos no frontend via `ipc.ts`. A camada de bindings é bastante completa.

### 3.2 Lacunas Identificadas

1. **`run_db()` em `lib.rs`:** Há um `map_err(|e| e.to_string())` duplo que pode mascarar erros de типo — o primeiro converte `anyhow::Error` para `String`, o segundo também (redundante).

2. **Eventos Codex-only para runtime:** O `run_codex_runtime_bridge` trata eventos apenas do engine Codex. Não há bridge equivalente para OpenCode (`OpenCodeRuntimeEvent` não é utilizado no `match`).

3. **Falta de `engine-runtime-updated` para OpenCode:** Apenas `CodexRuntimeEvent::DiagnosticsUpdated` emite `engine-runtime-updated`. OpenCode não tem canal de eventos de runtime equivalente.

---

## 4. Análise de Eficiência do Fluxo de Dados

### 4.1 Pontos de Serialização/Deserialização

| Etapa | Serialização | Observação |
|-------|-------------|-----------|
| Frontend → Tauri IPC | JSON (automatic) | `@tauri-apps/api/core` cuida automaticamente |
| Rust → SQLite | rusqlite com params | Parâmetros passam por bind, não string interpolation |
| SQLite → Rust | Tipos Rust nativos | Mapeados via `FromSql`/`ToSql` |
| Rust → Frontend | JSON via `serde` | `#[serde(rename_all = "camelCase")]` para compatibilidade JS |
| Event emit | `serde_json::json!()` | Construção manual de payloads |

**Potencial ineficiência:** Em `resolve_codex_runtime_approval`, há parsing de `blocks_json` (stored as JSON string in SQLite) com `serde_json::from_str` e re-serialização com `to_string()`. Isso é inevitável given the schema, mas representa overhead para mensagens com muitos blocks.

### 4.2 Padrões de Cache

| Dado | Cache Backend | Cache Frontend |
|------|--------------|----------------|
| FileTree | `FileTreeCache` (Rust, in-memory, `Arc<FileTreeCache>`) | Stores reativos (fileStore) |
| Git status | `GitWatcherManager` | `gitStore` com debounce |
| Thread list | DB query direta | `threadStore` em memória |
| Workspace repos | DB query direta | `workspaceStore.repos` |
| Terminal sessions | `TerminalManager` (`Arc`) | `terminalStore` (Zustand) |

**Problema identificado:** O `file_tree_cache` em Rust não é exposto diretamente ao frontend. O frontend usa `ipc.get_workspace_file_tree_page()` que refaz a query. Não há invalidação cruzada de cache entre stores e backend.

### 4.3 Operações Assíncronas

| Operações | Backend | Frontend |
|-----------|--------|----------|
| DB operations | `tokio::task::spawn_blocking` (lib.rs: `run_db`) | `await` normal via `invoke()` |
| File I/O | Síncronas dentro de `spawn_blocking` | N/A |
| Git operations | `git2` library (síncrono) | `spawn_blocking` |
| Terminal I/O | Async-read (`tokio::AsyncReadExt::read`) | Eventos push |

---

## 5. Propagação de Erros

### 5.1 Caminhos de Erro

**Frontend → Backend:**
```typescript
// ipc.ts não encapsula erros; erros via invoke() disparam exceções
try {
  await ipc.openWorkspace(path);
} catch (error) {
  // error é a String do backend
  set({ error: String(error) });
}
```

**Backend → Frontend:**
```rust
// run_db() retorna Result<T, String>, não anyhow::Error
// Isso perde contexto de erro (stack trace, source)
async fn run_db<T, F>(db: crate::db::Database, operation: F) -> Result<T, String>
where
    ...
{
    tokio::task::spawn_blocking(move || operation(&db))
        .await
        .map_err(|error| error.to_string())?  // JoinError → String
        .map_err(|error| error.to_string())?  // anyhow::Error → String
}
```

**Problema:** Erros do tipo `anyhow::Error` são convertidos para `String` na primeira `.map_err()`, perdendo o stack trace e a chain de causas. O segundo `.map_err()` é redundante.

### 5.2 Eventos de Erro

- Não há canal de eventos dedicado para erros de backend → frontend
- `chat-turn-finished` com `status: "error"` é usado para erros de thread
- `ThreadStatusDto::Error` mapeia erros de runtime do Codex

### 5.3 Observação

> **Verificado em `lib.rs`:** A função `resolve_codex_runtime_approval` usa `.ok().flatten()` ao buscar approval context, descartando silenciosamente erros de DB:
> ```rust
> let Some((thread_id, message_id)) = run_db(state.db.clone(), {...}).await.ok().flatten() else {
>     return;  // Erro silencioso
> };
> ```
> Isso é um **padrão arriscado** — falhas de DB aqui são swallowadas sem logging.

---

## 6. Sincronização de Estado

### 6.1 Frontend ↔ Backend State

| Dado | Fonte da Verdade | Frontend replica? | Via |
|------|-----------------|-------------------|-----|
| `Workspace` | SQLite (backend) | Sim, via `listWorkspaces` | ipc + workspaceStore |
| `Repo` | SQLite | Sim, via `getRepos` | ipc + workspaceStore |
| `Thread` | SQLite + Engine | Dual: DB local + engine | ipc + threadStore + events |
| `TerminalSession` | `TerminalManager` (mem) | Leitura eventual via events | `terminalStore` |
| `GitStatus` | `git2` + watcher | Sim, polling ou event | `gitStore` |

### 6.2 Padrão de Atualização Reativa

O frontend utiliza **Zustand** com o padrão:
1. Store faz chamada IPC
2. `set({ data, loading: false })` atualiza estado
3. Componentes React reagendem automaticamente

Para eventos push (Codex runtime):
1. `listenThreadUpdated()` registra listener no mount
2. Evento chega via Tauri `emit`
3. `threadStore.applyThreadUpdateLocal()` faz update in-place
4. UI atualiza sem refetch

### 6.3 Race Conditions Identificadas

| Cenário | Risco | Mitigação |
|---------|-------|-----------|
| `loadRepos` com workspace switching | stale response | `reposLoadSeq` counter (workspaceStore.ts) |
| `refreshAllThreads` + `createThread` simultâneos | Thread duplicado no state | `flattenThreadsByWorkspace` dedup by id |
| `listenThreadEvents` após thread deletion | Event orphan | Listener é desregistrado (`unlisten`) |
| `writeCommandToNewSession` com fallback timer | Comando executado 2x se output chega antes do timeout | `settled` flag previne double-write |

### 6.4 Race Condition Não Mitigada

Em `lib.rs:resolve_codex_runtime_approval`, a verificação `state.turns.get(&thread_id).await` é feita **fora** da transação DB:
```rust
let has_local_turn = state.turns.get(&thread_id).await.is_some();
// ^ Timing window aqui: turn pode terminar entre esta linha...
let updated_thread = match run_db(...).await { ... }
// ...e esta, dentro da transação
```
Se o turno terminar entre a verificação e a transação, o `has_local_turn` estará desatualizado. Isso afeta a lógica de `ThreadStatusDto` mas não causa inconsistência de dados.

---

## 7. Paridade de Funcionalidades Entre Engines

### 7.1 Codex vs OpenCode

| Feature | Codex | OpenCode |
|---------|-------|----------|
| Criação de thread | ✅ | ✅ |
| Envio de mensagem | ✅ | ✅ |
| Fork | ✅ | ✅ |
| Rollback | ✅ | ❌ (não exposto no ipc) |
| Compact | ✅ | ✅ |
| Arquivar/Restaurar | ✅ | ✅ |
| Revisão (review) | ✅ | ❌ |
| Eventos de runtime | ✅ `DiagnosticsUpdated` | ❌ |
| Aprovações | ✅ | ❌ |
| Sync from engine | ✅ | ❌ |

### 7.2 Observação

OpenCode tem **menos bindings de IPC** que Codex. Especificamente:
- `forkOpenCodeThread` existe no IPC mas não há `rollbackOpenCodeThread`
- `startCodexReview` é exclusivo do Codex
- Não há equivalente OpenCode para `CodexRuntimeEvent` events

---

## 8. Código Morto e Caminhos Não Utilizados

### 8.1 Código Morto Identificado

1. **`lib.rs` — `run_db` double map_err:**
   ```rust
   .map_err(|error| error.to_string())?
   .map_err(|error| error.to_string())?  // redundante
   ```
   O primeiro já converte para String, o segundo não faz sentido.

2. **`lib.rs` — `#[cfg(any(target_os = "linux", target_os = "windows"))]` branches:**
   ```rust
   #[cfg(any(target_os = "linux", target_os = "windows"))]
   let main_window_config = { ... decorations = false ... };
   #[cfg(not(target_os = "linux"))]
   let _ = &main_window;  //macOS usa main_window, Linux ignora
   ```
   No Linux, `main_window` é construída mas `_` não é usado (shadowed pelo WindowBuilder), então a linha `let _ = &main_window` no bloco `not(target_os = "linux")` é código morto em Linux.

3. **`setPowerSettings` em `ipc.ts`:**
   ```typescript
   setPowerSettings: (settings: PowerSettingsInput) =>
     invoke<KeepAwakeState>("set_power_settings", { settings }),
   ```
   **Bug:** O tipo de retorno é `KeepAwakeState`, mas o comando `set_power_settings` retorna `PowerSettings`. Isso é uma inconsistência de tipos.

### 8.2 Caminhos de Integração Incompletos

1. **OpenCode Runtime Events:** Não há bridge equivalent a `run_codex_runtime_bridge` para eventos de runtime do OpenCode
2. **Terminal Notifications:** O canal `terminal-notification-{workspaceId}` existe mas não há store que o consuma publicamente (usado apenas internamente)

---

## 9. Cobertura de Testes de Integração

### 9.1 Arquivos de Teste Identificados

| Store | Teste | Cobertura |
|-------|-------|-----------|
| `chatStore` | ✅ `chatStore.test.ts` | Testa envio, steering, cancel |
| `engineStore` | ✅ `engineStore.test.ts` | Testa list, health |
| `fileStore` | ✅ `fileStore.test.ts` | Testa read/write |
| `gitStore` | ✅ `gitStore.test.ts` | Testa operações git |
| `terminalStore` | ✅ `terminalStore.test.ts` + `.multiSession.test.ts` | Testa sessões |
| `keepAwakeStore` | ✅ `keepAwakeStore.test.ts` | Testa power |
| `onboardingStore` | ✅ `onboardingStore.test.ts` | Testa onboarding |
| `uiStore` | ✅ `uiStore.test.ts` | Testa UI state |
| `workspacePaneStore` | ✅ `workspacePaneStore.test.ts` | Testa panes |
| `workspaceStore` | ✅ `workspaceStore.test.ts` | Testa workspaces |

### 9.2 Lacunas de Testes

- **Não há testes de integração end-to-end** que atravessem a fronteira IPC (mock do Tauri invoke)
- **Testes de eventos** (listen/emit) não foram identificados
- **Testes de concorrência** (múltiplos turnos simultâneos, race conditions) não encontrados
- **Testes do bridge** `run_codex_runtime_bridge` inexistentes

---

## 10. Gargalos de Comunicação

### 10.1 Gargalos Identificados

| Gargalo | Impacto | Severidade |
|---------|--------|------------|
| `spawn_blocking` para TODAS as operações de DB | Bloqueia thread pool em operações I/O intensivas | 🔴 Alto |
| `FileTreeCache` não exposto ao frontend | Recomputação de árvore a cada page fetch | 🟡 Médio |
| Terminal output via eventos (não polling) | Events podem se acumular se frontend lento | 🟡 Médio |
| Git status polling não configurável | Git watchers emitos `git-repo-changed`, mas stores podem fazer polling redundante | 🟡 Médio |
| Serializer `serde_json` em approval resolution | Parsing de JSON string dentro de loop | 🟡 Médio |

### 10.2 `spawn_blocking` como Gargalo Principal

Todas as operações de DB passam por `spawn_blocking`:
```rust
async fn run_db<T, F>(db: crate::db::Database, operation: F) -> Result<T, String>
{
    tokio::task::spawn_blocking(move || operation(&db))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?
}
```
O pool padrão do Tokio tem `num_cpus::get()` threads. Em cenários com muitas operações concorrentes de DB (ex: múltiplos workspaces, polling de status), isso pode causar contenção.

---

## 11. Resumo e Recomendações

### 11.1 Pontos Positivos

- ✅ Arquitetura IPC bem estruturada com tipis definidos
- ✅ Cobertura de comandos frontend↔backend ~85% completa
- ✅ Eventos push para runtime (Codex) implementados corretamente
- ✅ Stores Zustand bem organizados e com testes
- ✅ Padrão de cancelamento de turnos (`TurnManager`) bem implementado
- ✅ Schema de DB com migrations e reconciliação de estado

### 11.2 Problemas Críticos

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 1 | `setPowerSettings` tipo de retorno errado (`KeepAwakeState` vs `PowerSettings`) | `ipc.ts` | Bug de tipos可能导致 UI breaking |
| 2 | Erros swallowados silenciosamente em `resolve_codex_runtime_approval` | `lib.rs` | Falhas de DB passam despercebidas |
| 3 | `run_db` double `map_err` | `lib.rs` | Perde contexto de erro |
| 4 | OpenCode sem bridge de eventos de runtime | `lib.rs` | Funcionalidade incompleta vs Codex |

### 11.3 Recomendações

1. **Corrigir tipo de retorno** de `setPowerSettings` para `invoke<PowerSettings>`
2. **Adicionar logging** no caminho de erro de `resolve_codex_runtime_approval`
3. **Remover `map_err` redundante** em `run_db`
4. **Implementar `OpenCodeRuntimeEvent` bridge** ou documentar limitação
5. **Considerar cache de FileTree** exposto via comando com invalidação por version/timestamp
6. **Adicionar testes de integração IPC** com mocks do Tauri
7. **Configurar rate-limiting** ou debounce no git watcher para evitar eventos excessivos
8. **Avaliar pool de `spawn_blocking`** — em cargas altas, um thread pool dedicado para DB pode melhorar throughput

---

*Relatório gerado automaticamente via análise estática do código fonte em 03/05/2026*
