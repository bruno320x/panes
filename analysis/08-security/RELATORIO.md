# Relatório de Análise de Segurança — Panes

**Data:** 03 de maio de 2026  
**Versão do Aplicativo:** Tauri 2 Desktop  
**Escopo:** Frontend (TypeScript/React) + Backend (Rust) + Sidecar Agent  
**Idioma:** Português

---

## Sumário Executivo

O Panes é um aplicativo desktop construído com Tauri 2 que integra agentes de IA (Claude, Codex, OpenCode) para assistência ao desenvolvedor. A análise de segurança identificou boas práticas implementadas (proteção contra path traversal, níveis de confiança, limites de tamanho de arquivo) bem como áreas que merecem atenção contínua.

**Classificação Geral:** O codebase demonstra atenção à segurança em áreas críticas, com proteções adequadas contra ataques comuns a desktop apps.

---

## 1. Validação de Comandos IPC do Tauri

### 1.1 Arquitetura de Permissões

O Tauri utiliza um sistema de **capabilities** (capacidades) baseado em JSON para controlar quais comandos IPC estão disponíveis para o frontend. O arquivo `src-tauri/capabilities/default.json` define:

```json
{
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-destroy", 
    "core:window:allow-hide",
    "core:window:allow-minimize",
    "core:window:allow-start-dragging",
    "core:window:allow-start-resize-dragging",
    "core:window:allow-toggle-maximize",
    "shell:allow-open",
    "dialog:allow-open",
    "fs:allow-read-text-file",
    "notification:default",
    "updater:default",
    "process:allow-restart"
  ]
}
```

**Análise:**
- ✅ O modelo de permissões é **minimalista** — apenas as operações necessárias estão expostas
- ✅ Não há permissão genérica de execução de comandos (`shell:allow-execute` ou similar)
- ⚠️ A permissão `fs:allow-read-text-file` permite leitura de qualquer arquivo — isso é restrito pelo backend via validação de path no Rust

### 1.2 Sistema de Níveis de Confiança

O aplicativo implementa um enum `TrustLevelDto` com três níveis:

```rust
pub enum TrustLevelDto {
    Trusted,    // Confiança total
    Standard,    // Confiança padrão  
    Restricted,  // Restrito — bloqueia escritas
}
```

**Mecanismo de Aplicação:**
- `TrustLevelDto::Restricted` **bloqueia operações de escrita** no repositório
- O usuário deve explicitamente alterar o nível de confiança antes que operações危险as sejam permitidas
- O nível padrão é `Standard`

**Avaliação:** ✅ Implementação adequada do princípio de menor privilégio

---

## 2. Controles de Acesso ao Sistema de Arquivos

### 2.1 Proteção contra Path Traversal

O arquivo `src-tauri/src/fs_ops.rs` implementa proteções robustas:

```rust
// Canonicaliza e verifica que o caminho está dentro do repositório
let canonical_repo = repo_path.canonicalize()
    .context("failed to canonicalize repo path")?;
let canonical_full = full_path.canonicalize()
    .context("failed to canonicalize full path")?;

if !canonical_full.starts_with(&canonical_repo) {
    return Err(anyhow::anyhow!("path traversal attempt detected"));
}
```

**Características:**
- ✅ Usa `canonicalize()` para resolver symlinks e caminhos relativos
- ✅ Verifica `starts_with()` após canonicalização
- ✅ Retorna erro descriptive em caso de tentativa de path traversal

### 2.2 Tratamento de Symlinks

```rust
// Se for symlink, verifica que aponta para dentro do repo
if entry.file_type()?.is_symlink() {
    let target = fs::read_link(entry.path())?;
    let canonical_target = target.canonicalize()?;
    if !canonical_target.starts_with(&canonical_repo) {
        // Pula symlinks que apontam para fora do repo
        continue;
    }
}
```

**Avaliação:** ✅ Symlinks externos são explicitamente ignorados

### 2.3 Limites de Tamanho e Tipo de Arquivo

```rust
const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB

// Detecção de binários por bytes nulos
fn is_binary(path: &Path) -> bool {
    let mut file = File::open(path).ok();
    let mut buffer = vec![0u8; 8192];
    let bytes_read = file.as_mut().map(|f| f.read(&mut buffer).ok()).unwrap_or(0);
    buffer[..bytes_read].iter().any(|&b| b == 0)
}
```

**Avaliação:** ✅ Limite de 10MB e detecção de binários são medidas adequadas contra ataques de DoS local

---

## 3. Segurança na Execução de Processos

### 3.1 Bandeira CREATE_NO_WINDOW (Windows)

Em `src-tauri/src/process_utils.rs`:

```rust
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW_FLAG: u32 = 0x08000000;

pub fn configure Command(cmd: &mut Command) {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW_FLAG);
}
```

**Avaliação:** ✅ Evita que processos filhos exibam consoles pop-up no Windows, prevenindo anúncios visuais de execução de comandos maliciosos

### 3.2 Suporte a Shells Cruzados

O sistema detecta e suporta múltiplos shells:
- **Unix:** bash, fish, zsh, sh
- **Windows:** cmd, powershell

```rust
pub fn detect_shell() -> String {
    // Detecta automaticamente o shell padrão do sistema
}
```

**Nota:** Cada shell tem características de escaping diferentes. A validação de input para estos shells deve ser feita pelo componente que chama a execução.

---

## 4. Tratamento de Credenciais e API Keys

### 4.1 Operações de Autenticação OpenCode

O sistema IPC expõe operações de autenticação:

```typescript
getOpenCodeProviderAuth: (cwd: string) => invoke<OpenCodeProviderAuthResponse>("get_opencode_provider_auth"),
setOpenCodeProviderAuth: (cwd: string, providerId: string, body: Record<string, unknown>) => invoke<unknown>("set_opencode_provider_auth"),
deleteOpenCodeProviderAuth: (cwd: string, providerId: string) => invoke<unknown>("delete_opencode_provider_auth"),
startOpenCodeProviderOAuth: (cwd: string, providerId: string, body: Record<string, unknown>) => invoke<unknown>("start_opencode_provider_oauth"),
completeOpenCodeProviderOAuth: (cwd: string, providerId: string, body: Record<string, unknown>) => invoke<unknown>("complete_opencode_provider_oauth"),
```

**Observações:**
- ⚠️ As operações `setOpenCodeProviderAuth` aceitam `Record<string, unknown>` para o body — **cabe ao backend validar o conteúdo**
- A implementação Rust não foi analisada em detalhe — requer auditoria adicional
- Fluxo OAuth implementado para integração com provedores

### 4.2 Armazenamento de Configuração

```rust
getOpenCodeConfig: (cwd: string) => invoke<Record<string, unknown>>("get_opencode_config"),
patchOpenCodeConfig: (cwd: string, body: Record<string, unknown>) => invoke<Record<string, unknown>>("patch_opencode_config"),
```

**Nota:** A configuração é armazenada por repositório (`cwd`), o que é uma boa prática de isolamento.

---

## 5. Prevenção de XSS e Injeção em Conteúdo de Chat

### 5.1 Estrutura de Mensagens

O sistema de mensagens (`MessageDto`) utiliza `Option<Value>` para blocos de conteúdo:

```rust
pub struct MessageDto {
    pub content: Option<String>,
    pub blocks: Option<Value>,  // Blocos de conteúdo arbitrários
    // ...
}
```

### 5.2 Gating de Tool Input

O arquivo `src/components/chat/claudeToolInputGating.test.ts` demonstra que existe **validação de tool inputs**:

```typescript
it("keeps malformed Claude tool-input approvals out of the composer path", () => {
  const malformedApproval = makeApprovalBlock("tool-input-invalid", {
    _serverMethod: "item/tool/requestuserinput",
    questions: [],  // Array vazio = rejeitado
  });
  expect(resolvePendingToolInputApproval([malformedApproval], "claude")).toBeNull();
});
```

**Mecanismos observados:**
- Validação de estrutura de perguntas (`questions: []` é rejeitado)
- Separação entre `isOpenCodeQuestionApproval` e permissões
- Engine-specific gating (Claude vs OpenCode vs Codex)

**Avaliação:** ✅ O frontend implementa validação de estrutura, mas **conteúdo de texto dentro das perguntas não parece ser sanitizado** — recommendação de adicionar sanitização XSS

---

## 6. Completude do Modelo de Permissões

### 6.1 PermissionPicker UI

O componente `src/components/chat/PermissionPicker.tsx` fornece interface para seleção de permissões.

### 6.2 Approval Workflow

O arquivo `src/components/chat/toolInputApproval.ts` implementa fluxo de aprovação:

```typescript
parseToolInputQuestions(questions: {_serverMethod: string, questions: {...}[]})
buildToolInputResponseFromSelections(questions, selections, customInputs)
```

**Elementos de Segurança:**
- ✅ `buildPermissionApprovalResponseForEngine` formata respostas específicas por engine
- ✅ Validação de `canUseApprovalDecisionActions` por tipo de engine
- ⚠️ As respostas são construídas no frontend — **validação adicional no backend é recomendada**

---

## 7. Segurança do Clipboard

### 7.1 Implementação

O arquivo `src/lib/clipboard.ts` expõe:

```typescript
export async function readClipboardText(): Promise<string | null>
export async function writeClipboardText(text: string): Promise<void>
```

**Observações:**
- O Clipboard API do navegador é usado — está sujeito às Same-Origin Policies do browser
- O Tauri propicia acesso ao clipboard nativo via `@tauri-apps/api`

**Risco:** ⚠️ **Potencial exposição de dados sensíveis via clipboard** — implementar timeout de clipboard ou auto-clear para dados sensíveis

---

## 8. Validação de Requisições de Rede

### 8.1 URLs e Provedores OpenCode

```typescript
getOpenCodeProviders: (cwd: string) => invoke<OpenCodeProviderListResponse>("get_opencode_providers"),
startOpenCodeProviderOAuth: (cwd: string, providerId: string, body: Record<string, unknown>)
```

**Não foi possível verificar:**
- Se o backend valida URLs de callback OAuth
- Se há proteção contra SSRF em integrações
- Se certificados TLS são validados corretamente

**Recomendação:** Auditoria específica de segurança de rede

---

## 9. Segurança do Sidecar Agent

### 9.1 Arquitetura

O sidecar em `src-tauri/src/sidecars/claude_agent/` é um processo separado que se comunica via:

```typescript
// runner.ts
startSession(sessionId: string, params: StartSessionParams): Promise<StartSessionResponse>
sendMessage(sessionId: string, message: string): Promise<SendMessageResponse>
```

### 9.2 Considerações

- ⚠️ O sidecar é um processo filho com capacidades de execução de comandos
- ✅ A comunicação entre processo principal e sidecar é via canais Rust internos (IPC do Tauri)
- ⚠️ **Não foi analisado** se o sidecar implementa rate limiting ou proteção contra prompt injection

---

## 10. Criptografia de Dados em Repouso

### 10.1 Observações

- O aplicativo usa SQLite (através do Tauri) para persistência local
- **Não foram identificadas** configurações explícitas de criptografia SQLite (como `PRAGMA encryption`)
- Credenciais de provider OAuth provavelmente armazenadas em texto ou com encryption key da aplicação

**Recomendação:** Se dados sensíveis são armazenados, implementar SQLCipher ou equivalente

---

## 11. Gerenciamento de Energia (macOS)

### 11.1 IOKit Assertions

O código em `src-tauri/src/power/macos.rs` usa IOKit para prevent sono:

```rust
IOPMAssertionCreateWithName(
    assertion_type: CFStringRef,
    assertion_level: u32,  // 255 = ON
    assertion_name: CFStringRef,
    assertion_id: *mut u32,
)
```

**Observações de Segurança:**
- ✅ As operações de **leitura** de estado de energia (`read_clamshell_state()`, `read_sleep_disabled()`) **não requerem privilégios de root**
- ✅ As operações de **escrita** (create/release assertions) usam APIs públicas da Apple
- ⚠️ `SleepDisabled` só pode ser ativado por um privileged helper (comentado no código)

---

## Vulnerabilidades e Riscos Identificados

| Severidade | Item | Descrição |
|------------|------|------------|
| **Média** | Clipboard | Dados sensíveis podem ser expostos via clipboard sem auto-cleanup |
| **Média** | OAuth | Validação de URLs de callback não verificada |
| **Média** | XSS | Conteúdo de chat não parece ser sanitizado antes de renderização |
| **Baixa** | Sidecar | Rate limiting e proteção contra prompt injection não verificados |
| **Baixa** | Rede | Validação de SSRF e certificados TLS não verificada |
| **Informacional** | Criptografia | Armazenamento SQLite sem criptografia verificada |

---

## Recomendações

### Alta Prioridade
1. **Implementar sanitização XSS** em todo conteúdo de chat antes de renderizar
2. **Adicionar auto-clear de clipboard** para dados sensíveis (ex: tokens, senhas)
3. **Validar URLs de callback OAuth** no backend para prevenir redirect attacks

### Média Prioridade
4. **Implementar rate limiting** no sidecar agent
5. **Adicionar logging de segurança** para operações de arquivo e execução de comandos
6. **Considerar SQLCipher** para armazenamento de dados sensíveis

### Baixa Prioridade
7. **Auditar dependências** JavaScript/npm por vulnerabilidades conhecidas
8. **Implementar Content Security Policy** mais restritiva no Tauri
9. **Documentar modelo de ameaça** completo

---

## Boas Práticas Identificadas

✅ **Proteção contra path traversal** com canonicalização + validação de prefixo  
✅ **Limites de tamanho de arquivo** (10MB) para prevenir DoS  
✅ **Detecção de binários** por bytes nulos  
✅ **Níveis de confiança** com bloqueio de escritas em nível Restrito  
✅ **CREATE_NO_WINDOW** flag no Windows para prevenir consoles pop-up  
✅ **Symlink filtering** para evitar escapes de sandbox  
✅ **Validação de estrutura** de approvals no frontend  
✅ **Modelo de permissões minimalista** no Tauri capabilities  

---

## Conclusão

O codebase do Panes demonstra **atenção à segurança** em áreas críticas como acesso ao sistema de arquivos, execução de processos e modelo de permissões. As proteções implementadas são adequadas para um aplicativo desktop de desenvolvimento.

As principais áreas de melhoria concentram-se em:
1. **Sanitização de conteúdo** (XSS)
2. **Proteção de clipboard** para dados sensíveis
3. **Validação de rede** (OAuth, SSRF)

Uma auditoria completa de segurança deve incluir testes de penetração manuais focados nas áreas identificadas como "não verificadas".

---

**Fim do Relatório**
