# Análise de Integração dos Engines de IA — Panes

> **Gerado em:** 2026-05-03  
> **Escopo:** Integração ponta-a-ponta dos engines Codex, Claude e OpenCode

---

## 1. Visão Geral da Arquitetura

O Panes integra **3 engines de IA** ativos através de uma arquitetura em camadas:

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React/TypeScript)                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐     │
│  │ ChatPanel.tsx │ │ ModelPicker  │ │ ChatCommandPanel │     │
│  └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘     │
│         │                │                  │                │
│  ┌──────┴────────────────┴──────────────────┴──────────┐    │
│  │ chatStore.ts (Zustand) + engineStore.ts              │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │ invoke() / listen()                │
├─────────────────────────┼───────────────────────────────────┤
│  IPC LAYER              │  Tauri Commands                    │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │ ipc.ts → invoke("send_message"), invoke("list_…")    │   │
│  └──────────────────────┬───────────────────────────────┘   │
├─────────────────────────┼───────────────────────────────────┤
│  BACKEND (Rust)         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │ commands/chat.rs + commands/engines.rs                │   │
│  └──────────────────────┬───────────────────────────────┘   │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │ EngineManager (mod.rs)                                │   │
│  │  ├─ CodexEngine        ── codex.rs / codex_transport  │   │
│  │  ├─ ClaudeSidecarEngine ─ claude_sidecar.rs           │   │
│  │  └─ OpenCodeEngine      ─ opencode.rs                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  events.rs → EngineEvent enum (unificado)                   │
└─────────────────────────────────────────────────────────────┘
```

**O módulo `api_direct.rs`** está vazio (reservado para futuro), apenas contendo um comentário placeholder.

---

## 2. Trait `Engine` — A Abstração Central

Todos os engines implementam o trait `Engine` definido em `mod.rs`:

```rust
#[async_trait]
pub trait Engine: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn models(&self) -> Vec<ModelInfo>;
    async fn is_available(&self) -> bool;
    async fn start_thread(…) -> Result<EngineThread>;
    async fn send_message(…, event_tx: mpsc::Sender<EngineEvent>) -> Result<()>;
    async fn steer_message(…) -> Result<()>;
    async fn respond_to_approval(…) -> Result<()>;
    async fn interrupt(…) -> Result<()>;
    async fn archive_thread(…) -> Result<()>;
    async fn unarchive_thread(…) -> Result<()>;
    // + list_models_runtime, health_report, prewarm, list_threads, etc.
}
```

### Avaliação da Abstração

| Aspecto | Avaliação | Detalhes |
|---------|-----------|----------|
| Interface comum | ✅ Boa | Trait unificado com métodos essenciais (start_thread, send_message, interrupt) |
| Tipo de evento unificado | ✅ Excelente | `EngineEvent` enum (`TextDelta`, `ActionStarted`, `ApprovalRequested`, etc.) padroniza a comunicação |
| Divergências per-engine | ⚠️ Vazamento | `EngineManager` faz dispatch por `match engine_id` com strings `"codex"`, `"claude"`, `"opencode"` — não usa o polimorfismo do trait |
| Métodos específicos | ⚠️ Vazamento | Diversos métodos expostos apenas para engine específico: `fork_codex_thread`, `compact_codex_thread`, `list_codex_skills`, `fork_opencode_remote_session`, etc. |
| Capabilities hardcoded | ⚠️ Manutenção | Capabilities replicadas 3x: backend `mod.rs`, frontend `engineCapabilities.ts`, e também no backend `capabilities_for_engine()` |

---

## 3. Engine por Engine — Integração End-to-End

### 3.1 Codex Engine

**Arquitetura:** Processo externo `codex app-server` comunicando via **JSON-RPC sobre stdio**.

#### Camadas:

| Camada | Arquivo | Detalhes |
|--------|---------|----------|
| Frontend | `ChatPanel.tsx`, `CodexConfigPicker.tsx`, `CodexReviewPicker.tsx`, `CodexRuntimePicker.tsx`, `CodexThreadPicker.tsx` | Pickers específicos para config, reviews, runtime, threads |
| IPC | `ipc.ts` | `forkCodexThread()`, `rollbackCodexThread()`, `compactCodexThread()`, `listCodexRemoteThreads()`, etc. |
| Backend Commands | `commands/chat.rs`, `commands/engines.rs` | `send_message`, `fork_codex_thread`, `start_codex_review` |
| Engine Manager | `mod.rs` — `EngineManager` | Dispatch via `match thread.engine_id` |
| Engine Core | `codex.rs` (~8230 linhas) | `CodexEngine` struct + `impl Engine` |
| Protocolo | `codex_protocol.rs` | JSON-RPC: parse incoming, request/response/notification |
| Transport | `codex_transport.rs` | `CodexTransport` — spawn processo, stdin/stdout, `request()` com timeout |
| Event Mapper | `codex_event_mapper.rs` (~2351 linhas) | `TurnEventMapper` — mapeia notificações Codex → `EngineEvent` |

#### Fluxo de envio de mensagem:

```
1. Frontend: ipc.sendMessage(threadId, message) 
   → Tauri invoke("send_message")
   
2. Backend chat.rs:
   - Valida attachments, model, reasoning_effort
   - resolve_thread_scope() → ThreadScope::Repo ou Workspace
   - EngineManager.ensure_engine_thread() 
   - EngineManager.send_message() → CodexEngine.send_message()
   
3. CodexEngine.send_message():
   - ensure_ready_transport() → spawn/reuse codex app-server
   - transport.request("turn/start", params, 600s timeout)
   - Subscribe to transport events (broadcast channel)
   - Map notifications via TurnEventMapper → EngineEvent
   - Send EngineEvent through event_tx (mpsc channel)
   
4. chat.rs event loop:
   - Receives EngineEvent from event_tx
   - Coalesces text deltas (24ms flush interval)
   - Persists blocks to SQLite
   - Emits "thread-stream-event" to frontend via Tauri Emitter
   
5. Frontend chatStore.ts:
   - listenThreadEvents() receives StreamEvent
   - Applies to in-memory Message[] via applyStreamEvent()
   - Merges TextDelta, ActionStarted, ApprovalRequested, etc.
```

#### Características únicas do Codex:

- **Transport restart com backoff** (max 3 tentativas, 250ms→2s backoff)
- **Protocol diagnostics** — métricas de saúde do protocolo
- **Thread fork/rollback/compact** — operações avançadas
- **Codex reviews** — code review com `review/start`
- **Approval routing** — `ApprovalRequestRoute` para responder a server requests
- **Runtime events broadcast** — `CodexRuntimeEvent` para atualizações de status
- **External sandbox detection** — auto-detecção de sandbox mode
- **Plan mode** — prompt prefix ou native collaboration mode

#### Avaliação: ✅ **Engine mais maduro e completamente integrado**

- 8230 linhas de código no engine core
- Protocolo JSON-RPC robusto com timeouts, retry, backoff
- Full feature set: fork, rollback, compact, reviews
- Health checks detalhados com diagnostic protocol

---

### 3.2 Claude Engine (Sidecar)

**Arquitetura:** Processo Node.js sidecar (`claude-agent-sdk-server.mjs`) comunicando via **JSON lines sobre stdio**.

#### Camadas:

| Camada | Arquivo | Detalhes |
|--------|---------|----------|
| Frontend | `ChatPanel.tsx` | Usa a interface genérica; `shouldShowClaudeUnsupportedApproval` para tool inputs |
| IPC | `ipc.ts` | Usa `send_message`, `respond_to_approval` genéricos |
| Backend Commands | `commands/chat.rs` | Mesmo fluxo genérico |
| Engine Manager | `mod.rs` | Dispatch para `ClaudeSidecarEngine` |
| Engine Core | `claude_sidecar.rs` (~1780 linhas) | `ClaudeSidecarEngine` + `ClaudeTransport` |
| Sidecar (Node.js) | `sidecar/claude-agent-sdk-server.mjs` (~1489 linhas) | Bridges Claude Agent SDK para JSON-line protocol |

#### Protocolo do Sidecar:

```
Sidecar → Rust (stdout, JSON lines):
  { type: "ready" }
  { type: "session_init", sessionId: "..." }
  { type: "turn_started" }
  { type: "text_delta", content: "..." }
  { type: "thinking_delta", content: "..." }
  { type: "action_started", actionId: "...", actionType: "command", ... }
  { type: "action_output_delta", actionId: "...", stream: "stdout", content: "..." }
  { type: "approval_requested", approvalId: "...", ... }
  { type: "turn_completed", status: "completed", tokenUsage: {...} }
  { type: "error", message: "...", recoverable: true }

Rust → Sidecar (stdin, JSON lines):
  { type: "start", sessionId: "...", prompt: "...", model: "...", ... }
  { type: "respond_approval", approvalId: "...", response: {...} }
```

#### Fluxo:

```
1. ClaudeSidecarEngine.ensure_transport():
   - Resolve sidecar path (dev ou bundled)
   - Spawn Node.js process
   - Wait for "ready" event (15s timeout)
   - Reuse existing transport if alive
   
2. send_message():
   - Send "start" command to stdin
   - Subscribe to stdout events via broadcast channel
   - Map SidecarEvent → EngineEvent
   - Handle approval workflow
```

#### Características únicas:

- **SDK module extraction** — extrai `@anthropic-ai/claude-agent-sdk` de tarball se não disponível
- **Node.js resolution** — busca node via login shell, Homebrew, etc.
- **Two-phase transport init** — evita segurar mutex durante spawn
- **Auth error detection** — detecção automática de erros de autenticação

#### Avaliação: ✅ **Bem integrado, mas com menos features que Codex**

- Sem fork/rollback/compact de threads
- Sem thread management avançado
- Sem remote session listing
- Transport restart é simplificado (apenas detecta morte)

---

### 3.3 OpenCode Engine

**Arquitetura:** Processo `opencode` com **API HTTP REST + SSE** para eventos.

#### Camadas:

| Camada | Arquivo | Detalhes |
|--------|---------|----------|
| Frontend | `OpenCodeAgentPicker.tsx`, `ModelPicker.tsx` (provider tree) | Seleção de agents, providers, modelos por provider |
| IPC | `ipc.ts` | ~30+ métodos específicos: `listOpenCodeRemoteSessions`, `forkOpenCodeRemoteSession`, `revertOpenCodeRemoteSession`, `getOpenCodeRuntimeCatalog`, `getOpenCodeProviders`, etc. |
| Backend Commands | `commands/engines.rs` | Métodos específicos para providers, config, OAuth |
| Engine Manager | `mod.rs` | Delegation para `OpenCodeEngine` |
| Engine Core | `opencode.rs` (~4392 linhas) | `OpenCodeEngine` — spawn local HTTP server, SSE streaming |

#### Fluxo:

```
1. OpenCodeEngine.spawn_server():
   - Encontra executável `opencode`
   - Inicia HTTP server em 127.0.0.1:{porta aleatória}
   - Aguarda "opencode server listening" no stderr
   - Registra server por cwd
   
2. send_message():
   - POST /session/{id}/prompt
   - SSE stream para eventos
   - OpenCodeTurnMapper processa eventos → EngineEvent
   
3. OpenCode Bus Events:
   - "part.updated" → TextDelta, ActionStarted, ActionCompleted
   - "session.updated" → status changes
   - "question.asked" → ApprovalRequested (perguntas do agente)
```

#### Características únicas:

- **Multi-provider model catalog** — suporta OpenAI, Anthropic, Google, Groq, Ollama, etc.
- **Agent selection** — diferentes agents (coding, custom, etc.)
- **Session management** — fork, revert, share, summarize
- **OAuth provider flow** — autenticação com providers externos
- **Tarefas/Todos** — suporte a tarefas dentro de sessões
- **Diff tracking** — diffs por sessão e mensagem
- **HTTP REST** — mais convencional que stdio JSON-RPC

#### Avaliação: ✅ **Integrado com rico session management, mas sem sandbox/permission mode nativo**

- `sandboxModes: []` — OpenCode não suporta sandbox do Panes
- `permissionModes: ["ask", "allow", "deny"]` — simplificado vs Codex/Claude
- Rich session management (fork, revert, share, summarize)

---

## 4. Sistema de Eventos Unificado

O `EngineEvent` enum (em `events.rs`) é o coração da comunicação:

```rust
pub enum EngineEvent {
    TurnStarted { client_turn_id: Option<String> },
    TurnCompleted { token_usage, status },
    TextDelta { content },
    ThinkingDelta { content },
    ActionStarted { action_id, action_type, summary, details },
    ActionOutputDelta { action_id, stream, content },
    ActionProgressUpdated { action_id, message },
    ActionCompleted { action_id, result },
    DiffUpdated { diff, scope },
    ApprovalRequested { approval_id, action_type, summary, details },
    UsageLimitsUpdated { usage },
    ModelRerouted { from_model, to_model, reason },
    Notice { kind, level, title, message },
    Error { message, recoverable },
}
```

Cada engine mapeia seus eventos nativos para este enum:
- **Codex:** `TurnEventMapper` (~2351 linhas) — complexo, lida com dezenas de métodos Codex
- **Claude:** `SidecarEvent → EngineEvent` mapping direto no `claude_sidecar.rs`
- **OpenCode:** `OpenCodeTurnMapper` — mapeia bus events para `EngineEvent`

---

## 5. Tratamento de Erros nas Fronteiras

### 5.1 Frontend → Backend

| Mecanismo | Detalhes |
|-----------|----------|
| Tauri invoke errors | `Result<T, String>` retornado como promise rejection |
| Validation em chat.rs | Validações de attachments, model availability, sandbox mode antes de enviar |
| Turn guard | `state.turns.get(&thread_id)` previne turns concorrentes |

### 5.2 Backend → Engine

| Mecanismo | Detalhes |
|-----------|----------|
| anyhow::Error propagation | Errors propagados com `.context()` para rastreabilidade |
| Transport timeouts | Codex: 30s default, 600s turn; Claude: 15s ready; OpenCode: 8s startup |
| Auth error detection | Codex: `is_auth_related_error`; Claude: `is_claude_auth_error` → invalida transport |
| Recoverable vs fatal | `EngineEvent::Error { recoverable: bool }` permite UI diferenciar |

### 5.3 Cross-boundary

| Cenário | Tratamento |
|---------|------------|
| Processo morre | Claude: `is_alive()` check + restart; Codex: `ensure_alive()` + transport restart |
| EOF inesperado | Claude: stdout EOF log + encerra; Codex: `transport/eof` notification |
| Parse error | Ambos logam warning e continuam |
| Timeout | `tokio::time::timeout` com fallback para erro |

### ⚠️ Problemas identificados:

1. **Erros como String:** `Result<T, String>` no IPC perde informações estruturadas
2. **Inconsistência de recovery:** Codex tem transport restart com backoff; Claude apenas reinicia; OpenCode tem server management
3. **Sem circuit breaker:** Nenhum engine implementa circuit breaker pattern para falhas repetidas

---

## 6. Condições de Corrida na Comunicação Async

### 6.1 Proteções Existentes

| Mecanismo | Engine | Descrição |
|-----------|--------|-----------|
| `transport_spawn_lock` | Codex | Mutex separado para serializar spawn de transport |
| `state: Arc<Mutex<…>>` | Todos | Estado protegido por tokio Mutex |
| `CancellationToken` | Todos | Cancelamento cooperativo de turns |
| `try_register()` | Chat command | Previne turns concorrentes no mesmo thread |
| Background stream listeners | Frontend | Mantém eventos ao trocar de thread |
| Two-phase transport init | Claude | Evita segurar mutex durante spawn lento |

### 6.2 Riscos Identificados

| Risco | Severidade | Descrição |
|-------|------------|-----------|
| **Codex transport restart durante turn ativo** | ⚠️ Médio | `invalidate_transport()` pode matar transport enquanto `send_message` aguarda resposta — mitigado por `request_with_fallback` |
| **Broadcast channel lag** | ⚠️ Baixo | `broadcast::Receiver::Lagged` tratado como `continue` em Claude, pode perder eventos |
| **OpenCode SSE reconnect** | ⚠️ Médio | SSE stream com 15min idle timeout — sem reconnect automático visível |
| **Approval race** | ⚠️ Baixo | `approval_requests` HashMap protegido por Mutex, serialização ok |
| **Frontend event ordering** | ⚠️ Médio | `enqueueStreamEvent()` faz coalescência; `STREAM_EVENT_BATCH_WINDOW_MS=16ms` — teoricamente ok mas sem sequence numbers |

---

## 7. Nível de Integração por Engine

### Matriz de Features

| Feature | Codex | Claude | OpenCode |
|---------|-------|--------|----------|
| Envio de mensagem | ✅ | ✅ | ✅ |
| Streaming de resposta | ✅ | ✅ | ✅ |
| Thinking/reasoning | ✅ | ✅ | ✅ |
| Approval workflow | ✅ | ✅ | ✅ |
| Cancel/Interrupt | ✅ | ✅ | ✅ |
| Model switching | ✅ | ❌ (fixo) | ✅ |
| Reasoning effort | ✅ (low→xhigh) | ❌ | ❌ |
| Thread fork | ✅ | ❌ | ✅ |
| Thread rollback | ✅ | ❌ | ❌ |
| Thread compact | ✅ | ❌ | ✅ |
| Remote thread listing | ✅ | ❌ | ✅ |
| Code review | ✅ | ❌ | ❌ |
| Sandbox modes | ✅ (3 modos) | ✅ (2 modos) | ❌ |
| Permission modes | ✅ (4 modos) | ✅ (3 modos) | ✅ (3 modos) |
| Personality | ✅ | ❌ | ❌ |
| Service tier | ✅ | ❌ | ❌ |
| File attachments | ✅ | ✅ | ✅ (via runtime) |
| Image attachments | ✅ | ✅ | ✅ (depende do modelo) |
| Skills/mentions | ✅ | ❌ | ❌ |
| Plan mode | ✅ (native+prompt) | ❌ | ❌ |
| Health checks | ✅ detalhado | ✅ básico | ✅ básico |
| Runtime model catalog | ✅ | ❌ (estático) | ✅ (via API) |
| Config management | ✅ | ❌ | ✅ |
| Session sharing | ❌ | ❌ | ✅ |
| Session revert | ❌ | ❌ | ✅ |
| Multi-provider models | ❌ | ❌ | ✅ |

### Avaliação Geral

| Engine | Integração | Maturidade | Observações |
|--------|-----------|------------|-------------|
| **Codex** | ✅✅✅ Completa | Alta | Engine principal, 8230 LOC, todas as features |
| **Claude** | ✅✅ Boa | Média | Funcional para chat, sem features avançadas |
| **OpenCode** | ✅✅✅ Completa | Alta | Rico session management, multi-provider |

---

## 8. Problemas e Recomendações

### 8.1 Problemas Críticos

1. **Dispatch por string hardcoded** — `EngineManager` usa `match engine_id { "codex" => …, "claude" => …, "opencode" => … }` em ~20 métodos. Adicionar um novo engine requer modificar dezenas de match arms.

2. **Capabilities duplicadas 3x** — `capabilities_for_engine()` no backend, `fallbackEngineCapabilities()` no frontend, e os dados vêm do backend via `list_engines()`. Inconsistência é garantida.

### 8.2 Problemas Moderados

3. **Engine-specific IPC methods** — O frontend tem ~30+ métodos específicos para Codex e OpenCode no `ipc.ts`. Isso acopla fortemente o frontend a engines específicos.

4. **`api_direct.rs` vazio** — Placeholder sem implementação.

5. **Sem trait para operações avançadas** — `fork_thread`, `compact_thread`, etc. são métodos específicos de cada engine, não parte do trait.

### 8.3 Recomendações

6. **Introduzir `EngineRegistry`** com registro dinâmico de engines, eliminando hardcoded dispatch.

7. **Criar trait estendido** `EngineExtended: Engine` para operações avançadas (fork, compact, review).

8. **Unificar capabilities** — enviar apenas do backend via `list_engines()`, remover duplicata frontend.

9. **Adicionar sequence numbers** aos eventos de stream para garantir ordenação.

10. **Implementar circuit breaker** para engines com falhas repetidas.

---

## 9. Mapa de Arquivos

### Backend (Rust)

```
src-tauri/src/engines/
├── mod.rs              (1327 linhas) — Engine trait, EngineManager, capabilities, DTOs
├── events.rs           (261 linhas)  — EngineEvent enum, TokenUsage, ActionType
├── codex.rs            (8230 linhas) — CodexEngine impl
├── codex_protocol.rs   (610 linhas)  — JSON-RPC parsing
├── codex_transport.rs  (413 linhas)  — Process spawn, stdin/stdout I/O
├── codex_event_mapper.rs (2351 linhas) — Codex events → EngineEvent mapping
├── claude_sidecar.rs   (1780 linhas) — ClaudeSidecarEngine + Node.js sidecar mgmt
├── opencode.rs         (4392 linhas) — OpenCodeEngine + HTTP/SSE
└── api_direct.rs       (1 linha)     — Placeholder vazio

src-tauri/sidecar/
└── claude-agent-sdk-server.mjs (1489 linhas) — Node.js bridge para Claude Agent SDK

src-tauri/src/commands/
├── chat.rs             (5378 linhas) — Tauri commands para chat/thread/messaging
└── engines.rs          (283 linhas)  — Tauri commands para engine discovery/health
```

### Frontend (TypeScript)

```
src/components/chat/
├── ChatPanel.tsx       (6226 linhas) — Chat UI principal
├── ChatCommandPanel.tsx               — Slash command panel
├── ChatSlashMenu.tsx                  — Slash menu (/, /review, etc.)
├── ModelPicker.tsx    (781 linhas)   — Model/engine selector com provider tree
├── OpenCodeAgentPicker.tsx            — OpenCode agent selector
├── CodexConfigPicker.tsx             — Codex personality/service tier
├── CodexReviewPicker.tsx             — Codex code review target
├── CodexRuntimePicker.tsx            — Codex runtime config
├── CodexThreadPicker.tsx             — Codex thread browser
├── composerRuntime.ts (43 linhas)    — Runtime snapshot builder
└── engineCapabilities.ts (60 linhas) — Capabilities fallback

src/stores/
├── chatStore.ts        (2182 linhas) — Chat state + streaming events
└── engineStore.ts      (163 linhas)  — Engine discovery + health cache

src/lib/
└── ipc.ts              (961 linhas)  — Tauri invoke wrappers
```

---

## 10. Conclusão

A integração de engines no Panes é **robusta e funcional**, com os três engines (Codex, Claude, OpenCode) completamente integrados para o fluxo core de chat. A abstração via trait `Engine` + enum `EngineEvent` é sólida para o caso de uso principal.

**Pontos fortes:**
- Sistema de eventos unificado que permite renderização engine-agnostic no frontend
- Tratamento de erros com timeouts, retry e detecção de auth failures
- Codex é extremamente bem integrado com features avançadas
- OpenCode tem rico session management multi-provider

**Pontos fracos:**
- Dispatch hardcoded por string em vez de polimorfismo via trait
- Capabilities e config duplicadas em múltiplos locais
- Alto acoplamento frontend↔engine-specific features
- Sem circuit breaker ou reconnect automático para SSE

O código total de integração de engines é de **~25.000 linhas Rust** + **~1.500 linhas Node.js** + **~10.000 linhas TypeScript**, indicando um sistema de maturidade significativa mas com dívida técnica acumulada na abstração.
