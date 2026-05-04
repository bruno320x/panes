# TASK-BUG3: Corrigir SQL injection em ensure_column

## Bug
- **Severidade:** 🟡 Moderada
- **Arquivo:** `src-tauri/src/db.rs`
- **Problema:** `format!()` concatena strings na query SQL - potencial SQL injection

## Passos

1. Use `mcp_serena_search_for_pattern` para localizar `ensure_column` em `db.rs`
2. Analise o código que monta a query SQL
3. Substitua concatenação de strings por parameterized queries
4. Verifique se há testes para essa função
5. Commit: `fix(db): use parameterized queries in ensure_column to prevent SQL injection`

## Ferramentas
- Use `mcp_serena_search_for_pattern` para localização
- Use `read_file` para contexto completo
- Use `patch` para edição

## Critério de Sucesso
- Query SQL usa parâmetros (?) em vez de format!
- Função ainda funciona corretamente
- Commit realizado
