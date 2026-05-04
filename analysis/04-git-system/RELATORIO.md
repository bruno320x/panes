# Relatório de Análise: Sistema Git do Panes

## 1. Visão Geral

O sistema Git do Panes é uma implementação completa de integração com Git que abrange operações de backend em Rust (via Tauri), gerenciamento de estado em TypeScript/Zustand, e uma interface de usuário React organizada em abas (Changes, Branches, Commits, Stash, Worktrees). A arquitetura adota uma estratégia dual-engine: tenta usar a CLI do Git como primária (`git status --porcelain`, `git add`, `git commit`, etc.) com fallback para a biblioteca `git2` (libgit2) quando a CLI falha.

---

## 2. Análise do Backend (Rust)

### 2.1 Estrutura dos Módulos

| Arquivo | Responsabilidade |
|---|---|
| `cli_fallback.rs` | Executor de comandos Git via CLI (`git -C <path> <args>`) |
| `repo.rs` | Lógica principal: status, diff, stage/unstage, commit, branch, stash, reset, push/pull/fetch, tree de arquivos |
| `multi_repo.rs` | Varredura de múltiplos repositórios no workspace, detecção de branch padrão |
| `worktree.rs` | CRUD de worktrees Git (add, list, remove, prune) |
| `watcher.rs` | File watcher de alta performance usando `notify`, com fallback para polling e debounce de eventos |

### 2.2 Completude das Operações Git

**Operações Implementadas ✅**

- Status do repositório (porcelain v1 + git2 fallback)
- Diff de arquivo (staged e unstaged)
- Compare de arquivo (Index vs Working Tree)
- Stage / Unstage de arquivos
- Discard de arquivos (checkout para tracked; clean para untracked)
- Commit com mensagem
- Soft reset (--soft HEAD~1)
- Fetch, Pull (--ff-only), Push (com set-upstream automático)
- Listagem de branches (local e remote) com paginação e busca
- Checkout de branch (local e remote com --track)
- Criação, renomeação e exclusão de branch
- Listagem de commits com paginação
- Listagem, push, apply e pop de stash
- Diff de commit específico
- File tree com cache, paginação, busca fuzzy e TTL
- Worktree: add, list, remove, prune
- Inicialização de repositório
- Gerenciamento de remotes (list, add, remove, rename)
- File watcher com debounce e fallback para polling

**Operações Faltantes ❌**

- **Rebase** (interativo ou não) — não há comando `git rebase`
- **Merge** — não há comando `git merge`
- **Cherry-pick** — não há comando `git cherry-pick`
- **Tag** — criação, listagem ou exclusão de tags
- **Blame** — não há `git blame`
- **Bisect** — não há `git bisect`
- **Submódulos** — não há suporte a submódulos Git (apenas detecta .git como arquivo na raiz de worktrees linked)
- **Reflog** — não há visualização do reflog
- **Stash pop** — existe `pop` mas não há `drop` explícito de stash individual (apenas via `git stash drop`)
- **GPG Sign** — não há opção de signed commits
- ** amend** — não há `commit --amend` (apenas soft reset)

### 2.3 Tratamento de Erros

O backend demonstra **bom tratamento de erros** nas operações mais críticas:

```rust
// Exemplo de tratamento de erros em push_repo (repo.rs:491-516):
match run_git(repo_path, &["push"]) {
    Ok(_) => Ok(()),
    Err(error) => {
        if !is_no_upstream_error(&error) {
            return Err(error).context("failed to push current branch");
        }
        // Fallback: detecta upstream ausente e tenta set-upstream
        let repo = Repository::open(repo_path)...;
        let branch_name = current_branch_name(&repo)...;
        let remote_name = default_remote_name(&repo)...;
        run_git(repo_path, &["push", "--set-upstream", remote_name.as_str(), branch_name.as_str()])...
    }
}
```

Pontos positivos:
- Fallback de CLI para git2 em `get_git_status` (linha 130-133)
- Validação de nome de branch em `add_git_worktree` (commands/git.rs:362-369)
- Validação de `commit_hash` em `get_commit_diff` (repo.rs:829-831)
- Contexto enriched em todos os comandos via `.context()`
- Tratamento específico para `is_no_upstream_error` e `is_missing_head_error`
- `ensure_gitignore_entry` para criação de worktrees

Pontos de atenção:
- `run_git` em `cli_fallback.rs` retorna erro genérico se `output.status.success() == false` — o stderr é capturado mas nem sempre é possível distinguir o tipo de erro
- Não há retry logic para operações de rede (fetch/pull/push)
- `discard_files` usa `git checkout --` para tracked e `git clean -fd` para untracked, mas se o arquivo for renomeado no index, o comportamento pode ser inesperado

### 2.4 Performance em Repositórios Grandes

**Mecanismos de cache e otimização:**

1. **FileTreeCache** (repo.rs:60-127):
   - TTL de 30 segundos (`FILE_TREE_CACHE_TTL`)
   - Limite de 50.000 entradas escaneadas (`FILE_TREE_MAX_SCAN_ENTRIES`)
   - Timeout de 2 segundos por scan (`FILE_TREE_SCAN_TIMEOUT`)
   - Invalidación granular por caminho

2. **Diff preview limits** (repo.rs:45-47):
   - `GIT_DIFF_PREVIEW_MAX_BYTES`: 512 KB
   - `GIT_DIFF_PREVIEW_MAX_LINES`: 10.000 linhas
   - Truncagem inteligente que preserva boundaries de UTF-8

3. **Pagination**:
   - `GIT_BRANCH_MAX_PAGE_SIZE`: 1.000 branches
   - `GIT_COMMIT_MAX_PAGE_SIZE`: 200 commits
   - `FILE_TREE_MAX_PAGE_SIZE`: 5.000 entradas

4. **GitWatcher** (watcher.rs):
   - Debounce de 650ms para evitar eventos duplicados
   - Fallback automático para PollWatcher quando inotifyfy atinge limite (Linux)
   - Filtro de caminhos `.git/` interno — apenas paths de alta сигнал (HEAD, index, refs, FETCH_HEAD, packed-refs) disparam eventos, ignorando objects/, logs/, hooks/

5. **Limpeza de estado**:
   - `prune_expired_locked` no cache de file tree
   - Memory management explícito com `statusCacheBytes` e `diffCacheBytes` no frontend

**Pontos de atenção para performance:**
- O scan de file tree é single-threaded e roda no thread pool (tokio::task::spawn_blocking), o que é correto
- `resolve_branch_ahead_behind` abre o repositório git2 para cada chamada — pode ser caro em multi-repo
- Não há streaming de commits — todos os commits são carregados via `rev-list` com paginação, mas para commits mais antigos pode haver latency spike

### 2.5 Suporte a Multi-Repo e Worktree

**Multi-repo (`multi_repo.rs`)**:
- `scan_git_repositories`: varredura BFS com profundidade máxima configurável
- Detecção de branch padrão via: origin/HEAD → qualquer remote/HEAD → local main → local master → HEAD atual
- Suporte a worktrees linked: detecta `.git` como arquivo (worktree linked vs repo normal)

**Worktree (`worktree.rs`)**:
- `add_worktree`: cria branch automaticamente com `-b`, suporte a base ref customizado
- `list_worktrees`: parsing de output `--porcelain` com detecção de bare, locked, prunable, detached
- `remove_worktree`: `--force` opcional, deleção de branch associada opcional
- `prune_worktrees`: limpeza de metadados órfãos

**Limitações do suporte a multi-repo/worktree:**
- `multi_repo.rs` não é exposto via comandos Tauri — é usado apenas internamente para `init_git_repo` e varredura de workspace
- Worktrees linked não são automaticamente detectados como repos separados no frontend — o usuário precisa selecionar manualmente
- O `mainRepoPath` e `activeRepoPath` no gitStore.ts gerenciam a relação main/worktree, mas não há representação de árvore de worktrees

---

## 3. Análise do Frontend (React/TypeScript)

### 3.1 Estrutura dos Componentes

| Componente | Descrição |
|---|---|
| `GitPanel.tsx` | Painel principal com tabs, ações de sync (fetch/pull/push), auto-refresh via watcher |
| `GitChangesView.tsx` | Lista de arquivos modificados com stage/unstage, diff viewer, commit UI |
| `GitBranchesView.tsx` | Lista de branches com busca, criação, renomeação, exclusão, checkout |
| `GitCommitsView.tsx` | História de commits com diff de commit selecionado |
| `GitStashView.tsx` | Lista de stashes com apply, pop |
| `GitWorktreesView.tsx` | Lista e gerenciamento de worktrees |
| `GitRemotesView.tsx` | Gerenciamento de remotos |
| `GitFilesView.tsx` | Tree de arquivos do repositório |
| `MultiRepoChangesView.tsx` | View accordion para múltiplos repos com status independentes |
| `gitChangesUtils.ts` | Utilitários de parsing de status e construção de tree rows |

### 3.2 Estado da Aplicação (Zustand — gitStore.ts)

**Características do store:**

1. **Cache de Status e Diff**:
   - LRU cache com limites de bytes (3MB status, 24MB diff)
   - TTL de 1s para status e 1.2s para diff
   - In-flight request deduplication (`statusInFlightByRepo`, `diffInFlightByKey`)
   - Revision tracking para invalidação (`repoRevisionByPath`)

2. **Operações assíncronas com loading refcount**:
   - `beginLoading()` / `endLoading()` com contador para evitar flicker
   - Request sequence para descarte de respostas obsoletas (`refreshSeq`, `selectFileSeq`, etc.)

3. **Draft persistence**:
   - Commit message e branch name salvos em `localStorage`
   - History de últimos 3 values para cada um

4. **Refresh Strategy**:
   - Para view "changes": força refresh com cache invalidation
   - Para outras views: usa `GIT_ACTIVE_VIEW_REFRESH_MIN_INTERVAL_MS` (1.5s) como throttle
   - Debounce de 550ms para watcher events na view changes

5. **Multi-repo sync state**:
   - `remoteSyncAction` + `remoteSyncRepoPath` para状态 visual durante fetch/pull/push
   - `mainRepoPath` para contexto de worktree

**Gaps do store:**
- Não há cache para `branches`, `commits`, `stashes`, `worktrees` — são sempre recarregados do backend
- `remotes` tem seu próprio estado (`remotesLoading`, `remotesError`) mas não é cacheable
- Não há optimistic updates para mutations (stage/unstage/commit são todos síncronos com o backend)

### 3.3 Alinhamento Frontend-Backend

**Comandos Tauri (commands/git.rs) → ipc bridge (src/lib/ipc.ts)**

Cada comando Rust tem um correspondente IPC em TypeScript. A maioria das operações segue o padrão:
```
Frontend (gitStore.ts) → ipc.<method>(args) → Tauri invoke → Rust command → git module
```

Exemplo de alinhamento:

| Backend (Rust) | Frontend (TypeScript) | Store Action |
|---|---|---|
| `stage_files` | `ipc.stageFiles` | `stage()` |
| `unstage_files` | `ipc.unstageFiles` | `unstage()` |
| `discard_files` | `ipc.discardFiles` | `discardFiles()` |
| `commit` | `ipc.commit` | `commit()` |
| `list_git_branches` | `ipc.listGitBranches` | `loadBranches()` |
| `checkout_git_branch` | `ipc.checkoutGitBranch` | `checkoutBranch()` |
| `add_git_worktree` | `ipc.addGitWorktree` | `addWorktree()` |

**Verificação de alinhamento:**
- ✅ Todos os 30+ comandos Rust têm correspondente ipc
- ✅ DTOs Rust (`GitStatusDto`, `GitBranchDto`, etc.) mapeiam para tipos TypeScript
- ✅ Parâmetros de paginação (offset, limit, search) consistentemente suportados
- ⚠️ `rename_git_branch` no backend (repo.rs:670) retorna apenas `()`, mas o frontend espera sucesso — alinhado
- ⚠️ `init_git_repo` tem parâmetro `validate_only` — alinhado

### 3.4 Casos Especiais Tratados no Frontend

**Detached HEAD:**
- `parse_porcelain_branch_header` (repo.rs:186-209): detecta "HEAD " no header e retorna "detached"
- `current_branch_name` (repo.rs:1322-1328): retorna `None` se head não é branch
- Frontend: branch name mostra "detached" para estado detached (via `GitStatusDto.branch`)
- `push_repo` (repo.rs:491-516): retorna erro específico se detached HEAD

**Merge Conflicts:**
- `is_porcelain_conflicted` (repo.rs:251-256): detecta códigos DD, AU, UD, UA, DU, AA, UU e U
- Status "conflicted" é renderizado para ambos index e worktree
- `get_git_file_compare` (repo.rs:349-400): detecta `GitChangeTypeDto::Conflicted` e marca `is_editable = false`
- Frontend: diff de arquivos conflicted não é editável, exibe mensagem de fallback

**Submódulos:**
- ⚠️ **Não há suporte dedicado a submódulos.** A detecção é limitada:
  - Se `.git` é um arquivo (worktree linked), o watcher resolve o `gitdir:` pointer e tracking de `commondir`
  - Mas submódulos (`.git` como symlink pointing para `../.git/modules/`) não têm tratamento especial
  - `scan_git_repositories` não detecta submódulos como repos separados

---

## 4. Integração e Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitPanel.tsx                              │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐ ┌─────────┐ │
│  │ Changes │ │ Branches │ │  Commits  │ │ Stash  │ │Worktrees│ │
│  └────┬────┘ └────┬─────┘ └─────┬─────┘ └───┬────┘ └────┬────┘ │
└───────┼──────────┼──────────────┼───────────┼─────────────┼──────┘
        │          │              │           │             │
        ▼          ▼              ▼           ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    gitStore.ts (Zustand)                        │
│  status[], branches[], commits[], stashes[], worktrees[]         │
│  activeRepoPath, mainRepoPath, activeView, remoteSyncState       │
└────────────────────────────┬────────────────────────────────────┘
                             │ ipc.<method>()
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Tauri IPC Bridge (ipc.ts)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ invoke()
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              commands/git.rs (Tauri Commands)                     │
│  get_git_status, stage_files, commit, list_git_branches, etc.   │
└────────────────────────────┬────────────────────────────────────┘
                             │ spawn_blocking()
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           git/ (repo.rs, worktree.rs, watcher.rs)                │
│  CLI fallback (git2) + file watching (notify)                   │
└─────────────────────────────────────────────────────────────────┘
```

**Fluxo de eventos (watcher):**
1. Backend: `notify` detecta mudança em `.git/HEAD`, `.git/index`, etc.
2. `GitWatcherManager::watch_repo` emite callback com `repo_path`
3. Tauri command `watch_git_repo` envia evento `git-repo-changed` via `app.emit`
4. Frontend: `listenGitRepoChanged` captura o evento
5. `scheduleRefresh()` / `flushRefresh()` no GitPanel atualiza status e diff

---

## 5. Lacunas e Issues Identificados

### 5.1 Issues de Completude

| Issue | Severidade | Descrição |
|---|---|---|
| Sem suporte a rebase | Alta | Não há comando `git rebase` — funcionalidade essencial para fluxo de trabalho Git |
| Sem suporte a merge | Alta | Não há `git merge` — usuários não podem fazer merge de branches pela UI |
| Sem signed commits | Média | Não há opção GPG/SSH signing para commits |
| Sem cherry-pick | Média | Não há capacidade de cherry-pick de commits |
| Sem stash drop | Baixa | `pop_git_stash` existe mas não há `drop_git_stash` (stash não é removable individualmente pelo UI) |
| Sem Tags | Baixa | Tags não são gerenciáveis pela UI |
| Sem blame | Baixa | `git blame` não está disponível |

### 5.2 Issues de Tratamento de Erros

| Issue | Severidade | Descrição |
|---|---|---|
| Erro genérico em run_git | Média | CLI fallback retorna `anyhow::bail!("git command failed: {stderr}")` — não categoriza erros (network vs. git vs. IO) |
| Sem retry em fetch/pull/push | Média | Operações de rede falham sem retry automático |
| Stash push sem stash drop | Baixa | Frontend tem `pushStash` mas não `dropStash` |
| Erro de detached HEAD em push | Média | Erro é claro mas o usuário não consegue fazer push de detached state pela UI |

### 5.3 Issues de Performance

| Issue | Severidade | Descrição |
|---|---|---|
| ahead/behind recalculado sempre | Média | `resolve_branch_ahead_behind` abre git2 repo em cada chamada — não há cache |
| File tree scan sem cache multi-level | Média | FileTreeCache tem TTL de 30s, mas o scan é 100% single-threaded em cada chamada |
| Poll interval fixo para working tree | Baixa | 5000ms fixo para changes view, 8000ms para multi-repo — não adaptativo |

### 5.4 Issues de UX/Edge Cases

| Issue | Severidade | Descrição |
|---|---|---|
| Detached HEAD: sem indicator claro | Média | Na branches view, detached HEAD mostra "detached" como branch name, mas não há warning visual proeminente |
| Conflict resolution manual | Alta | UI não guia o usuário pelo fluxo de resolution de conflitos — apenas mostra status conflicted |
| Submódulos: suporte inexistente | Alta | Repositórios com submódulos podem ter comportamento inesperado |
| Worktree: sem indicator visual | Baixa | Na multi-repo view, worktrees linked não são claramente distinguidos de repos normais |
| Empty state para commits | Baixa | Commits view não mostra mensagem quando repo não tem commits ainda (apenas lista vazia) |

---

## 6. Conclusões

### 6.1 Pontos Fortes

1. **Arquitetura dual-engine bem implementada**: fallback de CLI para git2 garante compatibilidade
2. **File watcher robusto**: debounce, fallback para polling, filtro de paths internos do .git
3. **Cache multi-layer**: file tree cache, status cache, diff cache com LRU eviction e byte limits
4. **Paginação consistente**: todas as listas usam offset/limit de forma uniforme
5. **Suporte a worktrees**: add, list, remove, prune funcionais
6. **UX de multi-repo**: accordion view com polling independente por repo
7. **Draft persistence**: commit messages e branch names sobrevêm a refreshes
8. **Testes unitários**: `multi_repo.rs` e `watcher.rs` têm testes; repo.rs tem testes de parsing

### 6.2 Pontos Fracos Principais

1. **Falta de operações de merge/rebase**: limita significativamente o fluxo de trabalho
2. **Sem tratamento de conflitos guiado**: usuário precisa resolver manualmente
3. **Cache limitado para ahead/behind**: cada chamada abre o repo git2
4. **Sem suporte a submódulos**: pode quebrar em repos com submódulos
5. **Erros categorizados de forma genérica**: dificultam UX customizada por tipo de erro

### 6.3 Recomendação Geral

O sistema Git do Panes é **bastante completo para operações diárias** (status, stage, commit, push/pull, branch management, stash, worktrees). A arquitetura é sólida com caching inteligente, file watching reativo e boa separação de responsabilidades.

**Para uso em produção**, as seguintes adições são recomendadas por ordem de prioridade:
1. Suporte a merge (mesmo que básico, com fast-forward only + full merge)
2. Dialog de resolução de conflitos
3. Stash drop (remoção individual)
4. Tags (list/create/delete)
5. Signed commits

---

*Relatório gerado em análise end-to-end do sistema Git do Panes. Fonte: `/tmp/panes/src-tauri/src/git/`, `/tmp/panes/src/components/git/`, `/tmp/panes/src/stores/gitStore.ts`, `/tmp/panes/src-tauri/src/commands/git.rs`.*
