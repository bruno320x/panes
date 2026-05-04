# Batch de Correções - Regras para Subagentes

## Contexto
- **Projeto:** Panes (Tauri 2 + Rust + React 19)
- **Repo:** /tmp/panes
- **MCPs disponíveis:** Serena (codebase analysis), Context7 (docs), Graphify (architecture)

## Regras Gerais
1. **ANTES de editar:** Use `mcp_serena_find_symbol` ou `mcp_serena_search_for_pattern` para localizar código exato
2. **Use Graphify** para entender dependências: `graphify path "<fileA>" "<fileB>"`
3. **Para APIs Rust/TypeScript:** Use Context7 para padrões corretos
4. **Teste mínimo:** Verifique sintaxe com `cargo check` (Rust) ou olhe imports (TS)
5. **Commits atômicos:** Um commit por bug/feature, mensagem descritiva

## Bugs a Corrigir

### BUG-1: `minify: false` no Vite (CRÍTICO)
**Severidade:** 🔴 Crítica
**Arquivo:** `vite.config.ts`
**Problema:** Build de produção sem minificação
**Ação:** Mudar para `minify: true` ou remover (default é true)

### BUG-2: `setPowerSettings` tipo errado
**Severidade:** 🟡 Moderada
**Arquivo:** `src-tauri/src/commands/power.rs`
**Problema:** `set_power_settings` retorna `KeepAwakeStateDto` mas deveria retornar `PowerSettingsDto`
**Ação:** Corrigir tipo de retorno

### BUG-3: SQL injection em `ensure_column`
**Severidade:** 🟡 Moderada
**Arquivo:** `src-tauri/src/db.rs`
**Problema:** `format!()` concatena strings na query
**Ação:** Usar parameterized queries

### BUG-4: `div role="button"` sem semântica
**Severidade:** 🟡 Moderada
**Arquivo:** Componentes de lista no frontend
**Problema:** `<div role="button">` deveria ser `<button>`
**Ação:** Substituir por elemento nativo ou adicionar role correto

### BUG-5: `unwrap()` em `FileTreeCache`
**Severidade:** 🟡 Moderada
**Arquivo:** `src-tauri/src/commands/git.rs` ou similar
**Problema:** Panic se mutex envenenado
**Ação:** Usar `unwrap_or_else` ou tratamento de erro

## Outputs Esperados
1. Cada bug: commit com mensagem `fix(<area>): <descricao>`
2. Arquivo `orquestrador/RESUMO-FIXES.md` com status de cada bug
3. Se bug não puder ser corrigido: documentar razão e alternativas
