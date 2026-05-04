# Relatório de Análise: Sistema de Terminal do Panes

**Data:** Domingo, 03 de Maio de 2026  
**Analista:** Agente Hermes  
**Versão do Código:** Análise baseada no estado atual do repositório

---

## 1. Visão Geral da Arquitetura

O sistema de terminal do Panes é uma arquitetura híbrida frontend/backend bem separada:

| Camada | Tecnologia | Responsabilidade |
|--------|------------|------------------|
| **Frontend** | React + xterm.js | Renderização, input do usuário, link detection |
| **Backend (Rust)** | portable_pty + tokio | PTY nativo, spooling de output, notificações OSC |
| **Estado** | Zustand (terminalStore.ts) | Gerenciamento de sessões, grupos, layouts |

### Arquivos Principais

**Backend:**
- `src-tauri/src/terminal/mod.rs` — TerminalManager, spawn de PTY, reader loop
- `src-tauri/src/terminal/osc_notifications.rs` — Parser OSC (9, 77, 99/Kitty)
- `src-tauri/src/terminal_notifications.rs` — TerminalNotificationManager, hooks Claude/Codex
- `src-tauri/src/commands/terminal.rs` — Comandos IPC Tauri

**Frontend:**
- `src/components/terminal/TerminalPanel.tsx` — Componente React principal
- `src/components/terminal/terminalCacheLifecycle.ts` — Política de eviction de terminais detachados
- `src/lib/terminalBootstrap.ts` — Lógica de inicialização
- `src/lib/terminalClipboard.ts` — Shortcuts de clipboard
- `src/lib/terminalFileReferences.ts` — Utilitários de posição de buffer
- `src/lib/terminalRenderingSettings.ts` — Rendering acelerado
- `src/stores/terminalStore.ts` — Estado global com testes

---

## 2. Qualidade da Emulação de Terminal

### 2.1 Frontend (xterm.js)

O frontend utiliza **@xterm/xterm** com addons especializados:

```
TerminalPanel.tsx:
├── FitAddon         → Auto-resize para container
├── Unicode11Addon   → Suporte a Unicode 11+
├── WebglAddon       → Renderização GPU (opcional)
└── ImageAddon       → Suporte a imagens Sixel/IIP
```

**Pontos Positivos:**
- Configuração de rendering acelerado via `emitTerminalAcceleratedRenderingChanged()`
- Diagnósticos de renderer expostos (`FrontendRendererDiagnostics`)
- Fallback graceful para WebGL quando indisponível
- Suporte a sixel e iip para imagens no terminal

**Pontos de Atenção:**
- O addon WebglAddon é conditionally loaded e pode falhar em alguns ambientes
- `webglContextLossCount` é monitorado mas não há recuperação automática documentada

### 2.2 Backend (Rust + portable_pty)

O backend Rust utiliza **portable_pty** para abstração de PTYcross-platform:

**Constantes de Performance (mod.rs):**
```rust
TERMINAL_OUTPUT_MIN_EMIT_INTERVAL_MS: 16    // ~60fps max
TERMINAL_OUTPUT_MAX_EMIT_BYTES: 256 * 1024 // 256KB por emit
TERMINAL_OUTPUT_BUFFER_MAX_BYTES: 2 * 1024 * 1024 // 2MB buffer total
TERMINAL_REPLAY_MAX_CHUNKS: 4096
TERMINAL_REPLAY_MAX_BYTES: 4 * 1024 * 1024  // 4MB de replay
TERMINAL_COMPLETED_REPLAY_GRACE_MS: 60_000  // 60s de graça
TERMINAL_COMPLETED_REPLAY_MAX_SESSIONS: 32
TERMINAL_COMPLETED_REPLAY_MAX_TOTAL_BYTES: 16 * 1024 * 1024 // 16MB total
```

**Funcionalidades Implementadas:**
- `spawn_session()` — Cria PTY com shell configurável
- Reader loop com output spooling e throttle
- Resize dinâmico (cols, rows, pixel_width, pixel_height)
- Suporte a replay de saída para terminais detachados
- IO counters detalhados (stdin_writes, stdout_bytes, dropped_bytes, etc.)

---

## 3. Performance com Output Grande

### 3.1 Mecanismos de Throttle

O sistema implementa **output throttling em 3 níveis**:

1. **Intervalo mínimo:** 16ms entre emits (≈60fps)
2. **Tamanho máximo por emit:** 256KB
3. **Buffer total máximo:** 2MB

```rust
// Backend: mod.rs - output reader loop
if emit_interval_elapsed && accumulated_bytes >= MAX_EMIT_BYTES {
    emit_to_frontend();
    reset_counters();
}
```

### 3.2 Buffer Circular

O `SharedTerminalOutput` usa um buffer circular com trim:
- Chunks são adicionados ao final
- Quando total_bytes > 2MB, chunks do início são removidos
- `trimmed_bytes` é累积ado nos IO counters

### 3.3 Replay System

Para terminais detachados:
- chunks são armazenados em `VecDeque<TerminalReplayChunkDto>`
- `replay_since_limited()` respeita `max_bytes` (default 4MB)
- Completed replays são mantidos por 60s ou até 32 sessões

### 3.4 Pontos de Atenção

⚠️ **Output muito grande pode causar drop:**  
Se o frontend não consome rápido suficiente, o buffer é trimado. O contador `stdout_dropped_bytes` existe mas não há mecanismo de backpressure documentado.

⚠️ **WebGL pode degradar com muito texto:**  
O addon Webgl não é recomendado para output massivo de texto sem formatação.

---

## 4. Suporte Multi-Session

### 4.1 Arquitetura

```
TerminalManager (Rust)
└── workspaces: HashMap<workspace_id, HashMap<session_id, TerminalSessionHandle>>
```

### 4.2 Frontend (terminalStore.ts)

**Estrutura de Dados:**
```typescript
WorkspaceTerminalState {
  sessions: TerminalSession[]        // sessões ativas
  groups: TerminalGroup[]            // grupos de split
  notificationsBySessionId: Record<string, TerminalNotification[]>
  activeSessionId: string | null
  focusedSessionId: string | null
  broadcastGroupId: string | null   // para broadcast de input
}
```

### 4.3 Worktree-based Isolation

Para harnesses (Codex/Claude), cada sessão pode ter seu próprio worktree Git:

```typescript
createMultiSessionGroup() {
  1. Para cada harness, criar worktree Git
  2. Criar terminal session com cwd no worktree
  3. Agrupar sessões em SplitNode
  4. Launch harness no terminal
}
```

**Testes verificam:**
- Rollback de worktrees se criação de sessão falhar
- Nomes únicos para worktrees repetidos (codex-1, codex-2)
- Limpeza adequada de worktrees órfãos

### 4.4 Broadcast Input

O `broadcastGroupId` permite enviar o mesmo input para todas as sessões de um grupo — útil para "clonar" ações entre agentes.

---

## 5. Integração com Clipboard

### 5.1 Shortcuts Implementados (terminalClipboard.ts)

```typescript
isTerminalCopyShortcut(event): Ctrl+Shift+C
isTerminalPasteShortcut(event): Ctrl+Shift+V ou Shift+Insert
```

### 5.2 Integração com Sistema

- `copyTextToClipboard()` — Wrapper sobre API de clipboard nativa
- `readTextFromClipboard()` — Lê do clipboard do sistema
- Ctrl+Shift+C no terminal copia seleção (não 망 Ctrl+C do processo)

### 5.3 Limitações

⚠️ **Sem suporte a copy-on-select automático** —须手动触发复制

⚠️ **terminalClipboard.ts é muito minimalista (46 linhas)** — apenas detecção de shortcuts, sem acesso real ao clipboard

---

## 6. Detecção de Referências de Arquivo

### 6.1 Arquitetura

O sistema detecta **file links** no output do terminal para permitir navegação:

```
TerminalPanel.tsx
├── extractTextLinkMatches(output)  // fileLinkNavigation.ts
├── getWorkspacePaneLeafIdFromEventTarget()
└── navigateLinkTarget(link, paneId)
```

### 6.2 Utilitários (terminalFileReferences.ts)

```typescript
offsetToTerminalBufferPosition()  // Converte offset → {x, y}
terminalMatchOffsetsToRange()     // Converte match → range de buffer
```

### 6.3 Tipos de Links Suportados

Baseado em `localFileLinkPatterns.ts`:
- Paths absolutos: `/home/user/project/file.ts`
- Paths relativos: `../src/main.rs`
- URLs de arquivo (Linux): `file:///tmp/log.txt`

### 6.4 Pontos de Atenção

⚠️ **Detecção é baseada em regex** — pode perder caminhos com caracteres especiais

⚠️ **Dependência de `getWorkspacePaneLeafIdFromEventTarget`** —须 que o terminal tenha um pane ID válido

---

## 7. Processamento de Notificações OSC

### 7.1 Parser (osc_notifications.rs)

O parser suporta **3 tipos de OSC**:

| Código | Origem | Formato |
|--------|--------|---------|
| OSC 9 | iTerm2 | `ESC ] 9 ; message BEL` |
| OSC 77 | KDE | `ESC ] 777 ; notify ; title ; body BEL` |
| OSC 99 | Kitty | `ESC ] 99 ; metadata ; payload ESC \` |

### 7.2 Kitty Protocol

O OSC 99 (Kitty) é o mais complexo, suportando:
- Notificações fragmentadas (título e body em separados)
- Codificação base64 (`e=1`)
- IDs de fragmento para notações multipart

### 7.3 Fluxo de Notificação

```
Terminal Output (OSC sequence)
    ↓
TerminalOscNotificationParser.consume()
    ↓
Separa: passthrough (pro terminal) vs notifications (pro app)
    ↓
TerminalNotificationManager (Rust)
    ↓
Evento Tauri "terminal-notification"
    ↓
Frontend TerminalPanel (listenTerminalNotification)
    ↓
ToastStore / Notification badge
```

### 7.4 Integrações Claude/Codex

O `terminal_notifications.rs` implementa **codex-notify** e **claude-hook**:

```rust
// Codex: Hook Wrapper
CODEX_WRAPPER_SUBCOMMAND = "codex-wrapper"
CODEX_NOTIFY_CONFIG_OVERRIDE = r#"notify=["panes","codex-notify"]"#

// Claude: Hook Command  
CLAUDE_HOOK_COMMAND = "panes claude-hook"
CLAUDE_NOTIFICATION_HOOK_EVENT = "Notification"
CLAUDE_SESSION_END_HOOK_EVENT = "SessionEnd"
```

### 7.5 Pontos Positivos

✅ Parser bem testado com unit tests (11 casos de teste)

✅ Suporta sequences divididas entre múltiplos reads

✅ Flush gracioso de sequências incompletas no `finish()`

✅ Ignora OSC 9 de progresso (`9;4;30;build`)

---

## 8. Gerenciamento de Memória

### 8.1 Terminal Detached Lifecycle

```
TerminalCacheLifecycle.ts
├── markWorkspaceTerminalDetached()  // Workspace switch → requireReplayOnAttach=true
├── markPaneTerminalDetached()       // Pane close → requireReplayOnAttach=false
├── shouldEvictDetachedTerminal()    // idleEvictionMs exceeded?
└── collectDetachedTerminalEvictionKeys() // Para cleanup
```

### 8.2 Política de Eviction

```typescript
shouldEvictDetachedTerminal(entry, now, idleEvictionMs):
  1. Se attached → never evict
  2. Se detachedAt undefined → evict immediately
  3. Se now - detachedAt >= idleEvictionMs → evict
```

### 8.3 Completed Replays

O backend mantém replays de sessões encerradas:
- Máximo 32 sessões simultâneas
- Máximo 16MB total
- Grace period de 60s após completar replay

### 8.4 IO Counters de Memória

```rust
TerminalSessionIoCounters {
    output_buffer_bytes: AtomicU64       // Bytes no buffer atual
    output_buffer_peak_bytes: AtomicU64  // Peak histórico
    output_buffer_trimmed_bytes: AtomicU64 // Total trimado
}
```

---

## 9. Issues e Limitações Identificadas

### 9.1 Issues de Performance

| Issue | Severidade | Descrição |
|-------|------------|-----------|
| Output flood sem backpressure | **Média** | Buffer é trimado, não há sinal de volta ao processo |
| WebGL context loss | **Baixa** | Contador existe mas não há recuperação automática |
| Replay chunks ilimitados | **Baixa** | 4096 chunks * 1KB ≈ 4MB, mas pode crescer |

### 9.2 Issues de Funcionalidade

| Issue | Severidade | Descrição |
|-------|------------|-----------|
| Clipboard muy básico | **Média** | Só Ctrl+Shift+C/V, sem copy-on-select |
| File references dependem de regex | **Média** | Pode perder caminhos incomuns |
| Sem search in-terminal | **Média** | xterm.js tem search addon mas não usado |
| Semantic tokens não implementados | **Baixa** | Só cores básicas de ANSI |

### 9.3 Issues de Integridade

| Issue | Severidade | Descrição |
|-------|------------|-----------|
| Orphaned worktrees | **Média** | Testes verificam cleanup, mas e se crash? |
| Race condition no reader loop | **Baixa** | Reader é spawned após insert no map |
| Sessões órfãs no close_workspace | **Baixa** | `close_workspace` faz lock de write, mas e se reader ainda rodando? |

### 9.4 Issues de UX

| Issue | Severidade | Descrição |
|-------|------------|-----------|
| Sem scroll-to-bottom automático | **Média** | Usuário须 scrollar manualmente |
| Zero pixel warning | **Baixa** | Só logging, sem notificação ao usuário |
| Fallo de attach sem retry | **Média** | `needsResumeOnAttach` mas sem retry automático |

---

## 10. Testes e Cobertura

### 10.1 Testes Existentes

| Arquivo | Tipo | Cobertura |
|---------|------|-----------|
| `terminalStore.test.ts` | Unit | `nextTerminalNumber()` |
| `terminalStore.multiSession.test.ts` | Integration | Worktree cleanup, multi-session group, rollback |
| `terminalCacheLifecycle.test.ts` | Unit | Eviction logic |
| `terminalBootstrap.test.ts` | Unit | Decisão de bootstrap |
| `terminalClipboard.test.ts` | Unit | Shortcut detection |
| `terminalFileReferences.test.ts` | Unit | Offset conversion |
| `osc_notifications.rs` (内联) | Unit | 11 casos de parse OSC |

### 10.2 Lacunas de Testes

⚠️ **Sem testes de stress** — output massivo, muitas sessões simultâneas

⚠️ **Sem testes de race condition** — reader loop e close simultâneos

⚠️ **Sem testes de memory leak** — buffers não liberados corretamente?

---

## 11. Conclusões e Recomendações

### 11.1 Pontos Fortes

1. **Arquitetura bem separada** — Frontend (xterm.js) vs Backend (Rust PTY) é limpo
2. **OSC parser robusto** — Suporta iTerm2, KDE e Kitty com testes
3. **Multi-session maduro** — Worktrees, grupos, broadcast input
4. **Memory limits configurados** — 2MB buffer, 16MB replay total
5. **IO counters detalhados** — Para diagnóstico de problemas

### 11.2 Recomendações de Melhoria

**Alta Prioridade:**
1. Implementar **backpressure** — notificar processo quando buffer está cheio
2. Adicionar **search addon** ao xterm.js
3. Implementar **retry automático** para attach de terminais

**Média Prioridade:**
4. Melhorar **clipboard** — copy-on-select, suporte a imagens
5. Adicionar **testes de stress** para output massivo
6. Implementar **periodic checkpoint** de replay para sessões longas

**Baixa Prioridade:**
7. WebGL recovery automático em context loss
8. Scroll-to-bottom toggleável
9. Semantic highlighting (se suportado por xterm.js)

### 11.3 Score Geral

| Aspecto | Score (1-5) | Comentário |
|---------|-------------|------------|
| Emulação | 4/5 | Bom suporte xterm.js + PTY, falta search |
| Performance | 3.5/5 | Throttle OK, sem backpressure |
| Multi-session | 4.5/5 | Worktree isolation é excelente |
| Integração App | 4/5 | Notificações OSC, hooks Claude/Codex |
| Memory | 4/5 | Limites OK, eviction policy clara |
| Testes | 3/5 | Unit tests bons, faltam integration/stress |

**Nota Final:** O sistema de terminal é **maduro e bem arquitetado**, com principalmente lacunas em testes de carga e algumas features de UX. A base Rust+PTY é sólida para uso em produção.

---

*Relatório gerado por Hermes Agent — 03/05/2026*
