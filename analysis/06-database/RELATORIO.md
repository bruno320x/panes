# Análise da Camada de Persistência de Dados — Panes

## 1. Visão Geral

O Panes utiliza **SQLite** como banco de dados principal, accessed via a library `rusqlite` no backend Rust (Tauri). O banco é persistido no arquivo `workspaces.db` dentro do diretório de dados da aplicação (`app_data_dir`). Existe também persistência via `localStorage` no frontend para preferências de UI.

---

## 2. Schema Design

### 2.1 Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `workspaces` | Workspace do usuário (root path, nome, scan_depth) |
| `repos` | Repositórios Git descobertos dentro de um workspace |
| `threads` | Conversas/threads com motor de IA |
| `messages` | Mensagens dentro de uma thread |
| `actions` | Ações executadas dentro de uma thread |
| `approvals` | aprovações pendentes de ações do usuário |
| `engine_event_logs` | Log de eventos do motor de IA |

### 2.2 Normalização

- **Bom**: As tabelas seguem uma estrutura normalizada com foreign keys apropriadas
- **Armazenamento JSON**: Colunas como `engine_metadata_json`, `blocks_json`, `details_json`, `result_json` são usadas para dados semiestruturados — escolha sensata para dados variáveis
- **Desnormalização controlada**: `threads.message_count` e `threads.total_tokens` são mantidos como contadores redundantes (desnormalizados) para performance, com função `refresh_thread_message_stats()` para recomputação

### 2.3 Índices

**Présentes (11 índices):**
```
idx_repos_workspace
idx_threads_workspace
idx_threads_repo
idx_threads_activity
idx_threads_workspace_status_activity
idx_messages_thread
idx_messages_thread_status_created
idx_actions_thread
idx_actions_thread_status_created
idx_approvals_thread
idx_approvals_message_status
```

**FTS (Full-Text Search):**
- `messages_fts` — tabela virtual FTS5 para busca em mensagens

**Análise deÍndices:**
- ✅ Os índices cobrem os padrões de query mais comuns (por workspace, por thread, ordenação por activity)
- ✅ Ínice composto `idx_threads_workspace_status_activity` é bem projetado para listagem de threads
- ⚠️ `engine_event_logs` **não tem índice** em `thread_id` — queries nessa tabela podem ser lentas
- ⚠️ Não há índice em `messages.thread_id` + `created_at` para window queries frequentes (apesar de existir `idx_messages_thread`)

### 2.4 Constraints

```
workspaces.root_path UNIQUE
repos UNIQUE(workspace_id, path)
Foreign Keys: workspaces(id) → CASCADE em threads, repos
Foreign Keys: repos(id) → SET NULL em threads (ao deletar repo)
Foreign Keys: threads(id) → CASCADE em messages, actions, approvals, engine_event_logs
```

**Problema identificado**: `threads.repo_id` usa `ON DELETE SET NULL`, o que pode deixar threads "órfãs" em termos de contexto de repositório — não há índice em `threads.repo_id` para otimizar queries que filtram por repo.

---

## 3. Estratégia de Migração

### 3.1 Sistema de Migração Atual

O sistema é **não-convencional** e apresenta **riscos**:

1. **Migração inicial** (`001_initial.sql`) é applied via `include_str!` + `execute_batch`
2. **Colunas são adicionadas dinamicamente** via funções `ensure_*` que verificam colunas existentes com `PRAGMA table_info` e executam `ALTER TABLE ADD COLUMN`
3. **Reparos de dados** são executados automaticamente (`repair_normalized_workspace_and_repo_paths`)

### 3.2 Funções de Verificação de Colunas

```rust
ensure_archived_columns()
ensure_workspace_git_columns()
ensure_repo_columns()
ensure_workspace_startup_columns()
ensure_runtime_columns()
ensure_messages_audit_columns()
```

### 3.3 Problemas Identificados

1. **Sem controle de versão de migração**: Não existe uma tabela `schema_migrations` ou similar. O sistema não sabe quais migrações já foram aplicadas
2. **ALTER TABLE ADD COLUMN idempotente**: O SQLite não suporta `ADD COLUMN IF NOT EXISTS` nativamente — o código confia que `PRAGMA table_info` retorna a lista correta e só adiciona se a coluna não existir
3. **Sem rollback**: Se uma migração falhar, não há mecanismo de rollback
4. **Migração de dados inline**: `repair_normalized_workspace_and_repo_paths` faz merge de duplicatas e normalização de paths como parte da inicialização — isso pode ser lento em bases de dados grandes
5. **Race condition potencial**: Se múltiplas instâncias abrirem o banco simultaneamente durante a migração, pode haver problemas

### 3.4 Recomendação

Implementar uma tabela de controle de migrações:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 4. Padrões de Query

### 4.1 N+1 Queries

**Não identificado problema significativo de N+1** — o código usa:
- `conn.prepare()` com `query_map()` para iterar resultados
- Transações explícitas (`tx.commit()`) para operações que afetam múltiplas tabelas
- Queries agregadas quando necessário (ex: `refresh_thread_message_stats`)

### 4.2 Queries de Exemplo Analisadas

**Bons padrões:**
```rust
// Query parametrizada com índice
"SELECT ... FROM threads WHERE workspace_id = ?1 
 AND archived_at IS NULL 
 AND (engine_thread_id IS NOT NULL OR EXISTS (...)) 
 ORDER BY last_activity_at DESC"

// Transação para reconcile
let tx = conn.transaction()?;
tx.execute(...)?;
tx.commit()?;
```

### 4.3 FTS (Full-Text Search)

- Tabela virtual `messages_fts` com triggers `INSERT`, `UPDATE`, `DELETE`
- Busca usa `searchable_text` como conteúdo principal
- Implementação correta para manter FTS em sync

---

## 5. Integridade de Dados

### 5.1 Foreign Keys

- ✅ `PRAGMA foreign_keys = ON` é habilitado na conexão
- ✅ `ON DELETE CASCADE` para workspaces → threads, repos
- ⚠️ `ON DELETE SET NULL` para repos → threads pode deixar threads sem repo
- ⚠️ `engine_event_logs` não tem constraint de FK explícita (tabela de log)

### 5.2 Integridade Transacional

- ✅ Uso de `Transaction` para operações multi-tabela (ex: `reconcile_workspace_repos`, `reconcile_runtime_state`)
- ⚠️ Algumas operações não usam transação (ex: `bump_message_counters` + `update_thread_status`分开调用) — não é atômico

### 5.3 Recovery de Estado Runtime

`reconcile_runtime_state()` faz:
1. Marca mensagens "streaming" órfãs como "interrupted"
2. Deriva status de cada thread baseado em approvals pendentes e último status de mensagem
3. Usa transação — **bom**

### 5.4 Normalização de Paths (Reparos)

`repair_normalized_workspace_and_repo_paths` executa:
- Merge de workspaces duplicados (mesmo root_path normalizado)
- Merge de repos duplicados (mesmo workspace_id + path normalizado)
- Remapeamento de referências (threads, repos)
- ⚠️ Isso roda **em cada inicialização** do banco — pode causar lentidão

---

## 6. Tratamento de Erros

### 6.1 Padrões Observados

```rust
.context("failed to insert action")?;
```

- Uso consistente de `anyhow::Context` para adicionar contexto a erros
- Uso de `.optional()` para queries que podem não retornar resultado
- Log de warnings para falhas de parse não-críticas (ex: `log::warn!("failed to parse approval details...")`)

### 6.2 Problemas

- Erros são propagados mas não há retry logic
- `busy_timeout` de 5 segundos pode não ser suficiente em cenários de alta concorrência
- Não há circuit breaker para falhas de banco

---

## 7. Connection Pooling e Acesso Concorrente

### 7.1 Implementação

```rust
const SQLITE_POOL_MAX_IDLE: usize = 8;

struct ConnectionPool {
    idle: Mutex<Vec<Connection>>,
    max_idle: usize,
}
```

- Pool manual com `Arc<Mutex<Vec<Connection>>>`
- Máximo de 8 conexões idle
- Conexões são configuradas (`configure_connection`) ao serem abertas

### 7.2 Configuração SQLite

```rust
conn.pragma_update(None, "foreign_keys", "ON")
conn.pragma_update(None, "journal_mode", "WAL")       // ✅ WAL é bom para concorrência
conn.pragma_update(None, "synchronous", "NORMAL")      // ✅ Bom equilíbrio performance/safety
conn.pragma_update(None, "temp_store", "MEMORY")       // ✅ Temp tables em memória
conn.busy_timeout(Duration::from_millis(5_000))       // ⚠️ 5s pode ser pouco
```

### 7.3 Análise

- ✅ **WAL mode**: Excelente escolha — permite leituras concorrentes enquanto outra conexão escreve
- ✅ **BUSY_TIMEOUT de 5s**: Razoável para uso típico, mas pode causar falhas em cenários com muitas transações concorrentes
- ⚠️ **Pool manual**: Não é um pool de conexões verdadeiro — conexões são tomadas do pool e devolvidas no `Drop`, mas SQLite não suporta múltiplas conexões simultâneas write (WAL ajuda, mas write precisa de lock exclusivo)
- ⚠️ **Sem validação de conexão**: Conexões não são validadas ao serem retiradas do pool

---

## 8. Backup e Recuperação

### 8.1 Situação Atual

- ❓ **Não identificado mecanismo de backup automático**
- ❓ **Não identificado mecanismo de VACUUM** ou otimização periódica
- ✅ **WAL mode** permite `sqlite3_backup` enquanto o banco está em uso
- O arquivo do banco é `workspaces.db` no app data dir

### 8.2 Recomendações

1. Implementar backup periódico via `sqlite3_backup` API
2. Adicionar comando de VACUUM periódico para reclaimar espaço
3. Considerar archival de threads/mensagens antigas

---

## 9. Persistência no Frontend (Stores)

### 9.1 localStorage — UI Preferences

| Store | Dados Persistidos |
|-------|-------------------|
| `workspaceStore.ts` | Último workspace selecionado (`LAST_WORKSPACE_KEY`), último repo por workspace (`LAST_REPO_BY_WORKSPACE_KEY`) |
| `workspacePaneStore.ts` | Layout de panes por workspace (`persistLayout`) |
| `uiStore.ts` | Sidebar pinned, Git panel pinned, Explorer open state |

### 9.2 Características

```typescript
// Exemplo de persistência (workspacePaneStore.ts)
function persistLayout(workspaceId: string, layout: WorkspacePaneLayout) {
    localStorage.setItem(STORAGE_KEY(workspaceId), JSON.stringify(layout));
}

// Erro ignorado silenciosamente
localStorage.setItem(STORAGE_KEY(workspaceId), JSON.stringify(layout));
// localStorage unavailable or full; ignore persistence failure.
```

- ⚠️ **Sem error handling real**: Falhas de `localStorage` são ignoradas
- ⚠️ **Sem TTL/expiração**: Dados persistem indefinidamente
- ⚠️ **Sem schema versioning**: Se a estrutura de dados mudar, dados antigos podem causar crashes

### 9.3 Migração de Dados Legados

O código tem `runtime_env::migrate_legacy_app_data_dir()` que tenta migrar de localizações antigas de dados — **bom para UX ao atualizar**

---

## 10. Problemas e Recomendações Resumidos

### 🔴 Críticos

1. **Sem tabela de controle de migrações**: Impossível saber quais alterações de schema já foram aplicadas
2. **Migração roda em toda inicialização**: `repair_normalized_workspace_and_repo_paths` executa em cada startup — pode causar lentidão
3. **Falhas de localStorage silenciadas**: Prejudica debugging e pode causar comportamento inesperado

### 🟡 Moderados

1. **`engine_event_logs` sem índice**: Queries nessa tabela podem ser lentas
2. **Pool de conexões manual**: Não é um pool true — conexões não são validadas
3. **BUSY_TIMEOUT de 5s**: Pode ser insuficiente em alta concorrência
4. **`ON DELETE SET NULL` em threads.repo_id**: Threads podem ficar sem contexto de repo

### 🟢 Positivos

1. **WAL mode**: Excelente para concorrência
2. **Uso de transactions**: Operações multi-tabela são atômicas
3. **Índices bem projetados**: Cobrem queries comuns
4. **FTS para busca**: Implementação correta de full-text search
5. **Foreign keys habilitadas**: Integridade referencial garantida
6. **Desnormalização consciente**: Contadores mantidos para performance com função de recomputação

---

## 11. Conclusão

A camada de persistência do Panes é **razoavelmente bem projetada** para um aplicativo de tamanho pequeno/médio. Os principais pontos de atenção são:

1. O sistema de migração precisa evoluir para um modelo versionado com tracking
2. A normalização de paths não deveria rodar em cada inicialização
3. O pool de conexões é funcional mas primitivo — poderia se beneficiar de `r2d2` ou similar
4. A persistência via `localStorage` no frontend carece de robustez (sem error handling, sem versionamento)

O uso de SQLite com WAL mode é uma escolha sólida para este tipo de aplicação desktop.
