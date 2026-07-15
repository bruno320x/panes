1. **Fase 0 — Baseline e proteção**
   - Confirmar o uso do package manager `pnpm` (já feito).
   - Remover os artefatos gerados `graphify-out` do controle de versão e adicioná-lo ao `.gitignore` (já feito).
   - O CSP foi alterado em `tauri.conf.json` para ser mais restritivo (já feito).

2. **Fase 1 — Backend Rust (Refatorando codex.rs) - Parte 1**
   - Criar diretório `src-tauri/src/engines/codex`.
   - Extrair `models.rs` de `src-tauri/src/engines/codex.rs`.
   - Utilizar `list_files` e `read_file` para validar a criação e as dependencias extraídas para `models.rs`.
   - Extrair `config.rs` de `src-tauri/src/engines/codex.rs`.
   - Utilizar `list_files` e `read_file` para validar `config.rs`.

3. **Fase 1 — Backend Rust (Refatorando codex.rs) - Parte 2**
   - Extrair `protocol.rs` de `src-tauri/src/engines/codex.rs`.
   - Utilizar `list_files` e `read_file` para validar `protocol.rs`.
   - Extrair `session.rs` e `paths.rs` de `src-tauri/src/engines/codex.rs`.
   - Utilizar `list_files` e `read_file` para validar as criações.
   - Validar com `cargo check`.

4. **Fase 1 — Backend Rust (Refatorando codex.rs) - Parte 3**
   - Extrair funções relacionadas ao sidecar para `src-tauri/src/engines/codex/process.rs`.
   - Utilizar `list_files` e `read_file` para validar a criação.
   - Extrair métodos de processamento de stream/eventos para `src-tauri/src/engines/codex/stream.rs` e `src-tauri/src/engines/codex/events.rs`.
   - Utilizar `list_files` e `read_file` para validar as criações.
   - Modificar `src-tauri/src/engines/codex.rs` para atuar como módulo principal referenciando os novos submódulos.
   - Validar com `cargo check`.

5. **Fase 1 — Backend Rust (Refatorando opencode.rs)**
   - Criar diretório `src-tauri/src/engines/opencode`.
   - Extrair dependências e `OpenCodeAgentDto`, `OpenCodeCommandDto` para `src-tauri/src/engines/opencode/models.rs`.
   - Utilizar `list_files` e `read_file` para validar `models.rs`.
   - Extrair Lógica de descoberta do binário e execução do sidecar para `src-tauri/src/engines/opencode/process.rs`.
   - Utilizar `list_files` e `read_file` para validar `process.rs`.
   - Extrair Métodos do protocolo REST/SSE para `src-tauri/src/engines/opencode/protocol.rs`.
   - Utilizar `list_files` e `read_file` para validar `protocol.rs`.
   - Modificar o arquivo principal `opencode.rs` para atuar como módulo importando esses novos sub-arquivos.
   - Validar com `cargo check`.

6. **Fase 2 — UI React (Refatorando ChatPanel.tsx) - Componentes 1**
   - Extrair `ChatHeader.tsx` de `src/components/chat/ChatPanel.tsx`.
   - Validar criação usando `list_files` e `read_file`.
   - Extrair `ChatInput.tsx` de `src/components/chat/ChatPanel.tsx`.
   - Validar criação usando `list_files` e `read_file`.

7. **Fase 2 — UI React (Refatorando ChatPanel.tsx) - Componentes 2**
   - Extrair `ChatThread.tsx` de `src/components/chat/ChatPanel.tsx`.
   - Validar criação usando `list_files` e `read_file`.
   - Extrair `ChatMessageList.tsx` de `src/components/chat/ChatPanel.tsx`.
   - Validar criação usando `list_files` e `read_file`.
   - Extrair `ChatToolbar.tsx` de `src/components/chat/ChatPanel.tsx`.
   - Validar criação usando `list_files` e `read_file`.

8. **Fase 2 — UI React (Refatorando ChatPanel.tsx) - Hooks**
   - Extrair hook de `useChatSession` de `src/components/chat/ChatPanel.tsx` para `src/components/chat/useChatSession.tsx`.
   - Validar criação usando `list_files` e `read_file`.
   - Extrair hook de `useChatStreaming` de `src/components/chat/ChatPanel.tsx` para `src/components/chat/useChatStreaming.tsx`.
   - Validar com `pnpm run typecheck` e `pnpm run test`.

9. **Fase 3 - Stores Zustand (chatStore) - Parte 1**
   - Extrair o slice `conversationsSlice.ts` de `src/stores/chatStore.ts` para a nova pasta `src/stores/chat/`.
   - Validar criação usando `list_files` e `read_file`.
   - Extrair o slice `messagesSlice.ts` para `src/stores/chat/`.
   - Validar criação usando `list_files` e `read_file`.

10. **Fase 3 - Stores Zustand (chatStore) - Parte 2**
   - Extrair o slice `streamingSlice.ts` para `src/stores/chat/`.
   - Validar criação usando `list_files` e `read_file`.
   - Extrair os slices `draftsSlice.ts` e `attachmentsSlice.ts` para `src/stores/chat/`.
   - Validar criação usando `list_files` e `read_file`.
   - Combinar os slices em `src/stores/chatStore.ts`.
   - Validar com `pnpm run typecheck`.

11. **Fase 3 - Stores Zustand (terminalStore) - Parte 1**
   - Criar diretório `src/stores/terminal/`.
   - Extrair o slice `sessionsSlice.ts` de `src/stores/terminalStore.ts`.
   - Validar criação usando `list_files` e `read_file`.
   - Extrair o slice `layoutSlice.ts` de `src/stores/terminalStore.ts`.
   - Validar criação usando `list_files` e `read_file`.

12. **Fase 3 - Stores Zustand (terminalStore) - Parte 2**
   - Extrair o slice `processStatusSlice.ts` de `src/stores/terminalStore.ts`.
   - Validar criação usando `list_files` e `read_file`.
   - Extrair os slices `notificationsSlice.ts` e `preferencesSlice.ts` de `src/stores/terminalStore.ts`.
   - Validar criação usando `list_files` e `read_file`.
   - Agrupar e conectar os slices dentro do arquivo principal `src/stores/terminalStore.ts`.
   - Validar via `pnpm run typecheck` e `pnpm run test`.

13. **Validação Final**
   - Executar todos os testes backend e frontend: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, `cargo check` e `cargo test`.

14. **Pre-commit e Entrega Final**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
   - Criar relatório de refatoração em `docs/refactor-production-report.md`.
   - Fazer o commit final com `git commit -m "refactor: production hardening and modular architecture"`.
