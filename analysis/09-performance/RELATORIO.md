# Relatório de Análise de Performance e Configuração de Build — Panes

**Data da análise:** Domingo, 03 de Maio de 2026  
**Projeto:** Panes (v0.59.0)  
**Stack:** Vite + React 19 + Tauri 2 + TypeScript + Rust

---

## 1. Sistema de Build

### 1.1 Vite (Frontend)

**Arquivo:** `vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,  // ⚠️ PROBLEMA: minificação desabilitada
  },
  server: {
    port: 1420,
    strictPort: true,
    hmr: { port: 1421 }
  },
  clearScreen: false
});
```

**Problemas identificados:**

| Configuração | Status | Impacto |
|---|---|---|
| `minify: false` | ⚠️ Crítico | Bundle final SEM minificação — tamanhos muito maiores |
| Sem code splitting manual | ⚠️ Aviso | Não há separação de chunks para vendor/UI/workers |
| Sem tree shaking explícito | ⚠️ Aviso | Dependências podem incluir código não utilizado |
| Sem compression (brotli/gzip) | ⚠️ Aviso | Assets não são pré-comprimidos |

### 1.2 TypeScript

**Arquivo:** `tsconfig.json`

```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "Bundler",
  "jsx": "react-jsx",
  "strict": true,
  "skipLibCheck": true,
  "isolatedModules": true
}
```

**Análise:** Configuração adequada. `moduleResolution: Bundler` é correto para Vite.

### 1.3 Rust / Cargo (Backend Tauri)

**Arquivo:** `src-tauri/Cargo.toml`

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png"] }
tokio = { version = "1", features = ["full"] }  # ⚠️ full features
rusqlite = { version = "0.31", features = ["bundled"] }
git2 = { version = "0.19", features = ["vendored-openssl"] }
```

**Problemas identificados:**

| Configuração | Status | Impacto |
|---|---|---|
| `tokio = { features = ["full"] }` | ⚠️ Alto | Inclui todas as features do Tokio — binary maior |
| Sem perfil de release customizado | ⚠️ Aviso | Não há `opt-level = 3` ou `lto = true` explícito |
| `git2` com `vendored-openssl` | ℹ️ Neutro | Necessário para operações Git, acceptable |
| `debug = 1` no profile.dev | ✅ Bom | Mantém debug info no dev sem explodir `target/` |

**Observação:** O Cargo.toml só define `[profile.dev]` mas NÃO define `[profile.release]`. Isso significa que o build de produção usa configurações padrão do Tauri (geralmente `opt-level = 2`).

### 1.4 Tauri

**Arquivo:** `src-tauri/tauri.conf.json`

```json
{
  "build": {
    "beforeBuildCommand": "node scripts/build-desktop.mjs",
    "frontendDist": "../dist"
  },
  "bundle": {
    "targets": ["app", "dmg", "deb", "appimage", "nsis"],
    "createUpdaterArtifacts": true
  }
}
```

---

## 2. Análise de Tamanho de Bundle

### 2.1 Dependências Pesadas

As seguintes dependências são conhecidas por seu impacto no tamanho do bundle:

| Dependência | Tamanho Estimado | Propósito |
|---|---|---|
| `@xterm/xterm` + addons | Alto (~1-2MB) | Emulador de terminal |
| `codemirror` + langs | Alto (~800KB-1.5MB) | Editor de código |
| `highlight.js/lib/common` | Médio-alto (~300KB) | Syntax highlighting no markdown parser |
| `react-markdown` + plugins | Médio (~200KB) | Renderização de markdown |
| `micromark` + extensions | Médio (~150KB) | Parser de markdown |
| `i18next` + react-i18next | Médio (~100KB) | Internacionalização |
| `@anthropic-ai/claude-agent-sdk` | Alto (~500KB+) | SDK do agente |
| `diff2html` | Médio (~100KB) | Visualização de diffs |
| `lucide-react` (~400KB) | ⚠️ tree-shaking necessário | Ícones |

### 2.2 Oportunidades de Otimização

1. **Habilitar minificação no Vite:**
   ```typescript
   build: {
     minify: 'terser',  // ou 'esbuild' (mais rápido)
     terserOptions: { compress: { drop_console: true } }
   }
   ```

2. **Code splitting por rota/feature:**
   - TerminalPanel, EditorWithExplorer, ChatPanel já usam `lazy()` ✅
   - Mas o xterm e codemirror devem ser separados em chunks dedicated

3. **Tree shaking do lucide-react:**
   ```typescript
   // Importar apenas ícones usados:
   import { File, Image, X } from 'lucide-react';
   // Em vez de: import { FileText, Image, X } from 'lucide-react';
   ```
   O projeto já faz imports individuais, entãotree shaking deve funcionar.

4. **highlight.js completo vs common:**
   O `markdownParserCore.ts` importa `hljs from "highlight.js/lib/common"` — isso é bom (apenas linguagens comuns).

---

## 3. Padrões de Performance em Runtime

### 3.1 Sistema de Telemetria de Performance

**Arquivo:** `src/lib/perfTelemetry.ts`

O projeto implementa um sistema robusto de telemetria com:

- **Budgets definidos:**
  ```
  chat.turn.first_shell.ms: 48
  chat.turn.first_content.ms: 1400
  chat.turn.first_text.ms: 1800
  chat.stream.flush.ms: 12
  chat.render.commit.ms: 16
  chat.markdown.worker.ms: 28
  git.refresh.ms: 350
  git.file_diff.ms: 250
  ```

- **Memorização de métricas:** Máximo 4.000 métricas armazenadas
- **Cooldown de warnings:** 8 segundos entre alertas do mesmo metric
- **Snapshot window:** Últimos 60 segundos por padrão

### 3.2 Web Workers

**Workers implementados:**

1. **`diffParser.worker.ts`** — Parse de diffs Git
   - Importa `parseDiff` de `../lib/parseDiff`
   - Retorna parsed lines, filename, contagem de adds/dels

2. **`markdownParser.worker.ts`** — Renderização de markdown para HTML
   - Usa `renderMarkdownToHtml` de `markdownParserCore.ts`
   - Tratamento de erros com response ok/fail

3. **`markdownParserCore.ts`** — Core do parser markdown
   - Usa `micromark` com extensões GFM
   - `highlight.js/lib/common` para syntax highlighting
   - Sanitização de HTML (remove scripts, iframes, event handlers)
   - Linkificação de referências a arquivos locais

**Padrão de uso:**

```typescript
// MarkdownContent.tsx e DiffViewer.tsx
let markdownWorkerInstance: Worker | null = null;

function ensureMarkdownWorker(): Worker | null {
  if (!markdownWorkerInstance) {
    markdownWorkerInstance = new Worker(
      new URL('./workers/markdownParser.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return markdownWorkerInstance;
}
```

**Avaliação:** ✅ Bom — Workers são singletons e reutilizados. Eles rodam parsing pesado fora da main thread.

### 3.3 React.memo e useMemo

**`React.memo`:** Nenhum uso encontrado em todo o codebase. ⚠️

**`useMemo`:** Uso EXTENSIVO — mais de 100 instâncias. Exemplos por arquivo:

| Arquivo | Qtd useMemo | Padrão |
|---|---|---|
| `ChatPanel.tsx` | ~50 | Virtualização, modelos, permissões |
| `GitPanel.tsx` | ~10 | Repositórios, opções |
| `CommandPalette.tsx` | ~10 | Comandos, workspaces |
| `TerminalPanel.tsx` | ~8 | Harnesses, sessões |
| `FileExplorer.tsx` | ~6 | Filas de arquivos |
| `MarkdownContent.tsx` | ~3 | Cache de HTML parseado |

### 3.4 useCallback

Uso extensivo de `useCallback` (~200+ instâncias). Padrões identificados:

- Handlers de eventos (click, keydown, pointerdown)
- Funções assíncronas (fetch, IPC calls)
- Debounced callbacks

### 3.5 Lazy Loading e Suspense

**Lazy components:**

```typescript
const LazyTerminalPanel = lazy(() => import('../terminal/TerminalPanel'));
const LazyEditorWithExplorer = lazy(() => import('../editor/EditorWithExplorer'));
const LazyChatPanel = lazy(() => import('../chat/ChatPanel'));
const LazyFileExplorer = lazy(() => import('../editor/FileExplorer'));
const LazyFileEditorPanel = lazy(() => import('../editor/FileEditorPanel'));
```

**Avaliação:** ✅ Bom — componentes pesados (Terminal, Editor) são carregados sob demanda via `Suspense`.

### 3.6 Padrões de Memory Leak Potenciais

**Fontes de vazamentos identificadas:**

1. **Timers sem cleanup:**
   - `setInterval` em `App.tsx:154` (global, verificado)
   - `setInterval` em `GitPanel.tsx:456` (polling)
   - `setInterval` em `MultiRepoChangesView.tsx:256` (polling multi-repo)
   - Múltiplos `setTimeout` não cancelados

2. **Event Listeners sem removeEventListener:**
   - `window.addEventListener` em App.tsx, ChatPanel.tsx
   - `document.addEventListener` em múltiplos componentes
   - `viewport.addEventListener` (scroll)

3. **Workers sem terminate:**
   - `markdownWorkerInstance` e `diffWorkerInstance` são singletons que nunca são terminados

**Padrões de cleanup observados:**

```typescript
// Exemplo de cleanup correto em ToastContainer.tsx
exitTimerRef.current = setTimeout(() => dismissToast(id), EXIT_MS);
// Os timers são geralmente armazenados em refs e limpos
```

### 3.7 Imagens e Assets

**Tratamento de imagens:**

- **Anexos de imagem:** Suporte a PNG, JPEG, GIF, WEBP, BMP, TIFF, SVG
- **xterm addon de imagem:** `@xterm/addon-image` integrado com tratamento de erros
- **Thumbnails:** AttachmentChip renderiza thumbnails de imagens
- **Paste de imagens:** Conversão para base64 e salvamento via IPC

**Otimizações identificadas:**

- Extensões de imagem filtradas por modalidade (Codex vs Claude)
- MIME type detection com fallback

---

## 4. Otimizações de Rede

### 4.1 Tauri IPC

- invoke/request-response pattern com promises
- Tratamento de erros com fallbacks
-Timeouts configurados (FALLBACK_TIMEOUT_MS, POST_OUTPUT_DELAY_MS)

### 4.2 Plugins Tauri

```
@tauri-apps/plugin-dialog
@tauri-apps/plugin-fs
@tauri-apps/plugin-notification
@tauri-apps/plugin-process
@tauri-apps/plugin-shell
@tauri-apps/plugin-updater
```

---

## 5. Recomendações de Otimização

### 5.1 Críticas (Prioridade Alta)

1. **Habilitar minificação no Vite:**
   ```typescript
   build: {
     minify: 'esbuild',  // ou 'terser' para melhor compressão
   }
   ```

2. **Adicionar perfil de release otimizado no Cargo.toml:**
   ```toml
   [profile.release]
   opt-level = 3
   lto = true
   codegen-units = 1
   strip = true
   ```

3. **Mudar tokio de `features = ["full"]` para features específicas:**
   ```toml
   tokio = { version = "1", features = ["rt", "sync", "fs", "io-util"] }
   ```

### 5.2 Importantes (Prioridade Média)

4. **Configurar code splitting no Vite:**
   ```typescript
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'vendor-react': ['react', 'react-dom'],
           'vendor-codemirror': ['codemirror', '@codemirror/view', '@codemirror/state'],
           'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit'],
         }
       }
     }
   }
   ```

5. **Adicionar compressão de assets:**
   ```typescript
   // Vite plugins para compressão
   import viteCompression from 'vite-plugin-compression';
   plugins: [react(), viteCompression()]
   ```

6. **React.memo em componentes filhos:**
   - Adicionar `React.memo` em componentes puramente presentacionais
   - Especialmente em `MessageBlocks.tsx`, `AttachmentChip.tsx`

### 5.3 Boas Práticas (Prioridade Baixa)

7. **Adicionar preload para rotas:**
   ```typescript
   const router = createBrowserRouter([
     { path: '/', element: <App />, children: [...] }
   ]);
   ```

8. **Considerar useTransition para updates não-urgentes:**
   - Conversões de markdown
   - Parsing de diffs grandes

9. **Lazy initialization para stores Zustand:**
   - Algumas stores podem usar lazy initialization para adiar criação de estado pesado

---

## 6. Métricas de Performance Existentes

O sistema de telemetria (`perfTelemetry.ts`) expõe `window.__panesPerf`:

```typescript
window.__panesPerf?.getSnapshot()  // Retorna métricas dos últimos 60s
window.__panesPerf?.clear()          // Limpa métricas
window.__panesPerf?.recent()         // Lista todas as métricas
```

**Budgets monitorados:**
- `chat.markdown.worker.ms`: 28ms
- `chat.render.commit.ms`: 16ms
- `git.refresh.ms`: 350ms
- `git.file_diff.ms`: 250ms

---

## 7. Conclusão

O projeto Panes apresenta uma **arquitetura de build funcional** com boas práticas como:

✅ Sistema de telemetria de performance robusto  
✅ Web Workers para parsing pesado (markdown, diff)  
✅ Lazy loading de componentes pesados  
✅ Uso extensivo de useMemo e useCallback  
✅ CodeMirror e xterm integrados com patterns de dispose  

Por outro lado, há **problemas críticos**:

⚠️ **Minificação DESABILITADA** no Vite — impacta diretamente o tamanho do bundle  
⚠️ **Tokio com features completas** — binary Rust maior que necessário  
⚠️ Sem perfis de release otimizados no Cargo  
⚠️ Sem code splitting configurado para vendor chunks

**Recomendação principal:** Habilitar minificação imediatamente e adicionar perfil de release otimizado no Rust.
