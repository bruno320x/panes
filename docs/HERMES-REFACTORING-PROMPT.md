# Prompt para Agent-Hermes: Decomposição do Panes

## Contexto

O projeto Panes (em `/home/bruninho/projetos/panes`) é um app Tauri (React + Rust) com ~130.000 linhas de código. Vários arquivos estão excessivamente grandes e precisam ser decompostos em módulos menores sem alterar funcionalidade.

**Estado atual:** O código compila e todos os 358 testes passam. Há 61 erros de compilação de uma tentativa anterior de refatoração que precisa ser revertida primeiro.

## Passo 0: Reverter ao estado limpo

```bash
cd /home/bruninho/projetos/panes
git checkout -- .
git clean -fd --exclude=node_modules --exclude=src-tauri/target --exclude=.serena --exclude=graphify-out
```

Validar: `npx tsc --noEmit` deve dar 0 erros. `npx vitest run --dir src` deve dar 358 testes passando.

---

## Tarefas de Decomposição

### REGRAS GLOBAIS
1. **Nunca alterar funcionalidade** — apenas mover código entre arquivos
2. **Após cada tarefa**, rodar `npx tsc --noEmit` (frontend) ou `cargo check --manifest-path src-tauri/Cargo.toml` (backend) — 0 erros
3. **Após cada tarefa**, rodar `npx vitest run --dir src` — 358 testes passando
4. **Se quebrar**, corrigir antes de prosseguir
5. **Manter re-exports** para backward compatibility quando outros arquivos importam do arquivo original
6. **Commitar após cada tarefa** com mensagem descritiva

---

### TASK-1: ChatPanel.tsx — Extrair funções exportadas
**Arquivo:** `src/components/chat/ChatPanel.tsx` (6277 linhas)
**Criar:** `src/components/chat/chatPanelExports.ts`
**Extrair:** As 5 funções `export function` que estão ANTES do componente principal:
- `resolvePendingToolInputApproval`
- `filterPendingApprovalBannerRows`
- `isOpenCodeQuestionApproval`
- `canUseApprovalDecisionActions`
- `buildPermissionApprovalResponseForEngine`

**Imports necessários no novo arquivo:**
```typescript
import type { ApprovalBlock, ApprovalResponse } from "../../types";
import { isRequestUserInputApproval, isSupportedClaudeToolInputApproval, parseToolInputQuestions, buildPermissionsApprovalResponse, buildPermissionsDeclineResponse } from "./toolInputApproval";
```

**No ChatPanel.tsx:**
- Remover as 5 funções
- Adicionar: `import { resolvePendingToolInputApproval, filterPendingApprovalBannerRows, isOpenCodeQuestionApproval, canUseApprovalDecisionActions, buildPermissionApprovalResponseForEngine } from "./chatPanelExports";`
- Adicionar re-export: `export { resolvePendingToolInputApproval, filterPendingApprovalBannerRows, isOpenCodeQuestionApproval, canUseApprovalDecisionActions, buildPermissionApprovalResponseForEngine } from "./chatPanelExports";`

**Validação:** `claudeToolInputGating.test.ts` importa essas funções de `./ChatPanel` — o re-export garante que continua funcionando.

---

### TASK-2: ChatPanel.tsx — Extrair tipos e opções de policy
**Criar:** `src/components/chat/chatPanelPolicyOptions.ts`
**Extrair:**
- Todos os `type` aliases: `CodexThreadApprovalPolicyValue`, `ClaudeThreadPermissionModeValue`, `OpenCodeThreadPermissionModeValue`, `ThreadApprovalPolicyValue`, `ThreadApprovalPolicyStateValue`, `ThreadSandboxModeValue`, `ThreadNetworkPolicyValue`, `ThreadExecutionPolicyPatch`
- Interface `CodexReferenceCatalogState`
- Constante `MODEL_TOKEN_LABELS`
- Funções: `getTrustLevelOptions`, `getCodexThreadApprovalPolicyOptions`, `getClaudeThreadPermissionModeOptions`, `getOpenCodeThreadPermissionModeOptions`, `getThreadSandboxModeOptions`, `getThreadNetworkPolicyOptions`, `isCodexExternalSandboxWarning`, `codexUsesExternalSandbox`

**Imports necessários:**
```typescript
import type { TFunction } from "i18next";
import type { TrustLevel, EngineHealth, CodexApprovalsReviewer } from "../../types";
```

**Exportar tudo** com `export`.

---

### TASK-3: ChatPanel.tsx — Extrair constantes de attachment e funções utilitárias
**Criar:** `src/components/chat/chatPanelAttachments.ts`
**Extrair:**
- Constantes: `IMAGE_ATTACHMENT_EXTENSIONS`, `TEXT_ATTACHMENT_EXTENSIONS`, `CODEX_ATTACHMENT_EXTENSIONS`, `CLAUDE_TEXT_ATTACHMENT_EXTENSIONS`, `CLAUDE_IMAGE_ATTACHMENT_EXTENSIONS`, `CLAUDE_ATTACHMENT_EXTENSIONS`, `PDF_ATTACHMENT_EXTENSIONS`
- Constantes: `ENGINE_PREWARM_THROTTLE_MS`, `lastPrewarmAttemptAtByEngine`, `inflightPrewarmByEngine`
- Funções: `scheduleIdleTask`, `prewarmEngineTransport`, `attachmentExtensionsForModalities`, `getAttachmentFilterConfig`, `getFileExtension`, `fileNameFromPath`, `isSupportedAttachmentName`, `guessMimeType`
- Interface `AttachmentFilterConfig`

---

### TASK-4: ChatPanel.tsx — Extrair MessageRow e componentes de mensagem
**Criar:** `src/components/chat/ChatMessageRow.tsx`
**Extrair:**
- Interface `MeasuredMessageRowProps`
- Função `MeasuredMessageRow`
- Interface `MessageRowProps`
- Constante `THINKING_VARIANTS`
- Hook `useThinkingVariant`
- Função `extractMessageCopyText`
- Componente `MessageCopyButton`
- Componente `MessageRowView`
- Constante `MessageRow` (memo wrapper)
- Constantes: `MESSAGE_VIRTUALIZATION_THRESHOLD`, `MESSAGE_ESTIMATED_ROW_HEIGHT`, `MESSAGE_ROW_GAP`, `MESSAGE_OVERSCAN_PX`
- Função `estimateMessageOffset`

---

### TASK-5: TerminalPanel.tsx — Extrair funções utilitárias
**Arquivo:** `src/components/terminal/TerminalPanel.tsx` (4416 linhas)
**Criar:** `src/components/terminal/terminalUtils.ts`
**Extrair** todas as funções que estão ANTES do componente principal e não usam React hooks:
- `terminalCacheKey`, `terminalWorkspacePrefix`, `forEachWorkspaceCachedTerminal`, `parseTerminalCacheKey`, `touchCachedTerminal`, `refreshTerminalCursor`
- `setTerminalFocusState`, `lockTerminalFocus`, `unlockTerminalFocus`
- `logTerminalDebug`, `logTerminalWarning`, `errorToMessage`, `isLikelyImageAddonError`
- `createRendererDiagnostics`, `cloneFrontendDiagnostics`, `snapshotFrontendRuntime`
- `terminalInputChunkLength`, `isUtf16LowSurrogate`, `isUtf16HighSurrogate`, `clampInputChunkBoundary`, `shouldFlushInputImmediately`
- Todas as interfaces/types associados
- Todas as constantes de módulo (MAX_*, FLUSH_*, etc.)

---

### TASK-6: TerminalPanel.tsx — Extrair funções de rendering
**Criar:** `src/components/terminal/terminalRenderer.ts`
**Extrair:**
- `setupImageAddon`, `setupWebglRenderer`, `degradeRendererToCanvas`, `applyAcceleratedRenderingPreference`
- `scheduleBackendRendererDiagnosticsRefresh`, `recordImageAddonRuntimeError`
- Interfaces: `ImageAddonCapabilities`, `FrontendRendererDiagnostics`, etc.

---

### TASK-7: TerminalPanel.tsx — Extrair funções de input
**Criar:** `src/components/terminal/terminalInput.ts`
**Extrair:**
- `registerFlushStall`, `warnDroppedTerminalInput`, `pullInputBatch`, `pullInputChunk`, `pullProtocolInputChunk`
- `flushTerminalInputQueue`, `scheduleTerminalInputFlush`, `enqueueTerminalInput`, `enqueueTerminalProtocolInput`, `enqueueTerminalInputBytes`
- Tipo `TerminalInputChunk` e constantes associadas

---

### TASK-8: Sidebar.tsx — Decompor em sub-componentes
**Arquivo:** `src/components/sidebar/Sidebar.tsx` (1517 linhas)
**Criar:**
- `src/components/sidebar/SidebarNav.tsx` — navegação principal (botões de ação)
- `src/components/sidebar/SidebarWorkspaceList.tsx` — lista de workspaces
- `src/components/sidebar/SidebarThreadList.tsx` — lista de threads
- `src/components/sidebar/sidebarUtils.ts` — funções utilitárias puras

---

### TASK-9: MessageBlocks.tsx — Extrair blocos individuais
**Arquivo:** `src/components/chat/MessageBlocks.tsx` (1695 linhas)
**Criar:**
- `src/components/chat/blocks/ActionBlockView.tsx`
- `src/components/chat/blocks/ApprovalBlockView.tsx`
- `src/components/chat/blocks/CodeBlockView.tsx`
- `src/components/chat/blocks/ThinkingBlockView.tsx`
- `src/components/chat/blocks/DiffBlockView.tsx`

Cada bloco é um componente independente que recebe props e renderiza um tipo de bloco.

---

### TASK-10: Backend Rust — codex.rs
**Arquivo:** `src-tauri/src/engines/codex.rs` (8230 linhas)
**Criar diretório:** `src-tauri/src/engines/codex/`
**Dividir em:**
- `mod.rs` — struct CodexEngine, impl Engine, funções públicas principais (~800 linhas)
- `transport.rs` — CodexTransport, conexão HTTP/WS (~400 linhas)
- `session.rs` — criar/attach/detach/listar sessões (~600 linhas)
- `stream.rs` — parsing de eventos SSE, stream handling (~800 linhas)
- `approvals.rs` — PendingApproval, fluxo de aprovação (~500 linhas)
- `models.rs` — catálogo de modelos, capabilities (~300 linhas)
- `messages.rs` — construção de mensagens, extract_imported_messages (~400 linhas)
- `config.rs` — health check, sandbox policies (~300 linhas)

**Atualizar** `src-tauri/src/engines/mod.rs` para usar `mod codex;` (diretório) em vez do arquivo único.

---

### TASK-11: Backend Rust — commands/chat.rs
**Arquivo:** `src-tauri/src/commands/chat.rs` (5378 linhas)
**Criar diretório:** `src-tauri/src/commands/chat/`
**Dividir em:**
- `mod.rs` — Tauri command handlers (dispatch) + re-exports
- `send.rs` — send_message, build_user_blocks
- `stream.rs` — run_turn, cancel_turn, stream event handling
- `approvals.rs` — respond_to_approval, approval routing
- `attachments.rs` — save_pasted_image, read_attachment_preview

---

### TASK-12: Backend Rust — commands/threads.rs
**Arquivo:** `src-tauri/src/commands/threads.rs` (4117 linhas)
**Criar diretório:** `src-tauri/src/commands/threads/`
**Dividir em:**
- `mod.rs` — Tauri command handlers + re-exports
- `opencode.rs` — list/attach/get OpenCode remote sessions
- `codex.rs` — Codex remote threads, branch threads
- `policy.rs` — set_thread_execution_policy, trust level logic

---

### TASK-13: Backend Rust — engines/opencode.rs
**Arquivo:** `src-tauri/src/engines/opencode.rs` (4486 linhas)
**Criar diretório:** `src-tauri/src/engines/opencode/`
**Dividir em:**
- `mod.rs` — struct OpenCodeEngine, impl Engine
- `session.rs` — sessões, attach, detach
- `stream.rs` — OpenCodeTurnMapper, event handling
- `models.rs` — parse_verbose_model_records, catálogo
- `providers.rs` — auth, provider list, config

---

## Validação Final

Após todas as tarefas:
```bash
cd /home/bruninho/projetos/panes
npx tsc --noEmit          # 0 erros
npx vitest run --dir src  # 358 testes passando
cargo check --manifest-path src-tauri/Cargo.toml  # 0 erros
```

## Notas Importantes

1. **Rust é mais fácil** — funções têm assinaturas explícitas, sem closures compartilhando state. Basta mover funções e adicionar `pub(crate)` + `use super::*` ou imports explícitos.

2. **TypeScript/React é mais difícil** — componentes compartilham state via closures. Só extrair funções que estão FORA do componente principal (antes do `export const ComponentName = memo(...)`).

3. **Nunca tentar quebrar o corpo de um componente React** que usa muitos useState/useCallback interconectados. Isso requer reescrita arquitetural, não decomposição mecânica.

4. **Commitar após cada task** — se algo quebrar, pode reverter apenas a última task.
