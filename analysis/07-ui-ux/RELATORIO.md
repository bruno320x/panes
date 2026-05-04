# Relatório de Análise UI/UX — Panes

**Data:** 03 de maio de 2026
**Versão Analisada:** Panes (desktop app com React 19 + Tauri)
**Escopo:** Layout, Navegação, Acessibilidade, Consistência de Design, Responsividade, Fluxo de Onboarding, Experiência do Usuário

---

## 1. Visão Geral

O Panes é um desktop app de produtividade para desenvolvedores que combina chat com agentes de IA (Codex, Claude Code, etc.), terminal integrado e editor de código em uma interface de múltiplos painéis (*panes*) com sidebar colapsável. A arquitetura UI é construída com React 19, i18next para internacionalização (EN-US e PT-BR), e Tauri para o runtime desktop.

---

## 2. Layout e Consistência Visual

### 2.1 Estrutura de Três Colunas (ThreeColumnLayout)

O layout principal é composto por:
- **Sidebar esquerda:** Navegação de workspaces, threads e configurações. Pode estar fixada (*pinned*) ou colapsada em um trilho (*rail*) com flyout sob hover.
- **Área de conteúdo central:** Área flutuante "content-card" que contém o workspace ativo (Chat, Terminal ou Editor).
- **Painel Git:** Pode estar docked (painel redimensionável) ou como flyout flutuante.

**Pontos Positivos:**
- Uso do `react-resizable-panels` para redimensionamento fluido com persistência em localStorage (`panes:sidebar-width`, `panes:git-panel-size`).
- Limites mínimos e máximos bem definidos para todas as áreas redimensionáveis (sidebar: 160–380px, git panel: 18–40%).
- Transições suaves com CSS transitions para estados de hover e collapse.
- Suporte a *focus mode* que remove a sidebar e expande o conteúdo.

**Problemas Identificados:**

1. **Inconsistência de estado do trilho (rail):** O `CollapsedRail` tem `opacity: flyoutVisible ? 0 : 1` durante transições de hover, o que causa um "flicker" visual quando o mouse sai do rail mas ainda está sobre o flyout. O timeout de 150–200ms para fechar o flyout pode causar comportamento confuso em usuários que movem o mouse rapidamente.

2. **Git flyout com delay de fechamento:** A implementação usa `setTimeout` com delays de 150–200ms para `closeGitFlyout()`. Isso é funcional mas pode causar Z-index inesperado se o mouse passar sobre outros elementos durante o delay.

3. **CSS inline pesado:** Componentes como `SidebarContent` e `ThreeColumnLayout` usam muitos estilos inline (`style={{...}}`), o que:
   - Dificulta a manutenção e主题 (*theming*)
   - Mistura responsabilidades de apresentação com lógica de componente
   - Não se beneficia de otimizações CSS do Tailwind ou classes compartilhadas

4. **Valores mágicos de delay:** Há múltiplos valores de delay para flyouts (150ms, 200ms, 0ms para `gitFlyoutInternalPointerResetTimer`) sem documentação clara da razão de cada um.

### 2.2 Sidebar (Sidebar.tsx)

A sidebar tem dois modos:
- **Modo fixado (pinned):** Renderiza `SidebarContent` diretamente.
- **Modo colapsado:** Renderiza `CollapsedRail` + flyout com portal (`createPortal`).

**Problemas:**

1. **Nomenclatura inconsistente:** A função principal exportada se chama `Sidebar`, mas internamente há `SidebarContent` e `CollapsedRail`. Isso pode confundir desenvolvedores.

2. **Ausência de ARIA para flyout:** O flyout da sidebar não tem atributo `role` ou `aria-expanded` no gatilho (rail button). O estado de expansão/collapse não é exposto a leitores de tela.

3. **Portal地狱 (*portal hell*):** São usados **5 `createPortal`** simultâneos para: settings menu, workspace confirm dialog, thread confirm dialog, flyout wrapper, e update dialog. Cada portal adiciona complexidade de gerenciamento de foco e ordem de tabulação.

4. **Thread items usam `role="button"` em `<div>`:** A linha 396 do `SidebarContent`:
   ```tsx
   <div role="button" tabIndex={0} ...>
   ```
   Isso é semanticamente incorreto. Deveria ser um `<button>` ou um elemento com role correto.

### 2.3 Design System e CSS

**Arquivo:** `src/globals.css`

**Pontos Positivos:**
- Uso de variáveis CSS para cores (`--accent`, `--text-3`, `--danger`, etc.)
- Separação de concerns com classes com prefixos (`sb-` para sidebar, `hp-` para harness panel, `ws-` para workspace, `toast-` para notificações)
- Transições suaves definidas em CSS (`transition: background 0.15s, color 0.15s`)

**Problemas:**

1. **Sobrecarga de regras específicas:** Classes como `sb-nav-item-shortcut` (atalhos de teclado) têm estilo hardcoded (fonte, tamanho) sem variável CSS correspondente.

2. **Valores de opacity hardcoded:** `rgba(255,255,255,0.06)` e `rgba(248, 113, 113, 0.15)` aparecem em vários lugares sem variáveis CSS centralizadas.

3. **Ausência de CSS customizado para scrollbars:** Não há estilos para scrollbars personalizados, o que pode parecer inconsistente em diferentes plataformas.

4. **Falta de foco visível em alguns elementos interativos:** Botões no rail (`sb-rail-btn`) usam `border: "none"; background: "transparent"`, o que pode tornar difícil identificar o estado de foco para navegação por teclado.

---

## 3. Navegação e Fluxo do Usuário

### 3.1 Command Palette (CommandPalette.tsx)

A Command Palette é o hub central de navegação, acessível via `⌘K`. Suporta múltiplos modos:
- **Commands:** Ações de layout, Git, terminal, etc.
- **Thread:** Navegação entre threads
- **Workspace:** Troca de workspaces
- **File:** Busca de arquivos

**Pontos Positivos:**
- Prefixos dinâmicos (`?` para busca, `>` para comandos) conforme `detectCommandPaletteMode`
- Suporte a scopes de busca (All, Messages, Files, Threads)
- Feedback visual com ícones e contadores de status
- Suporte a atalhos de teclado footer (`navigate`, `select`, `open`, `run`, `dismiss`)

**Problemas:**

1. **Tradução inconsistente no footer:** Há um typo na chave `navigate`:
   ```json
   "footer": { "navigate": "navigate" }
   ```
   Deveria estar em maiúscula ou como "Navegar" em pt-BR para consistência com outras ações.

2. **Placeholders duplicados:** Há `toggleExplorer` tanto em `commands` quanto em `group`, mas semanticamente `toggleExplorer` é mais uma ação de *view* do que um comando Git.

3. **Performance de busca:** A busca por arquivos (`searchFiles`) pode ser lenta em workspaces grandes. Não há evidência de debounce ou cancelamento de buscas anteriores.

### 3.2 Sidebar Navigation

**Fluxo:**
1. Usuário abre workspace (botão `+` ou `open folder`)
2. Workspaces aparecem na sidebar com threads filhas
3. Click em workspace expande/colapsa threads
4. Click em thread abre Chat com contexto do repo

**Problemas:**

1. **"Nova thread" desabilitado sem workspace ativo:** O botão `New Thread` no sidebar não tem estado disabled visual claro quando não há workspace. O ícone SVG inline (logo "Panes") não é acessível por keyboard.

2. **Falta de busca/filter na sidebar:** Em usuários com muitos workspaces/threads, não há como filtrar a lista visualmente.

3. **Arquivados (*Archived*) sempre visível:** A seção de workspaces/threads arquivados está sempre visível, ocupanto espaço mesmo quando vazia. Deveria estar colapsada por padrão.

---

## 4. Acessibilidade (Accessibility)

### 4.1 Keyboard Navigation

**O que funciona:**
- `⌘K` abre Command Palette
- `⌘⇧N` cria nova thread
- `⌘⇧F` abre busca
- `Escape` fecha dialogs e flyouts
- `Enter`/`Space` ativam botões e items com `role="button"`
- `Tab` cycle funciona em dialogs modais

**Problemas Críticos:**

1. **Sidebar rail não é navegável por teclado:** Os botões do `CollapsedRail` não têm `tabIndex` adequado. Quando o rail está visível e o flyout está fechado, o usuário keyboard-only não consegue acessar a navegação principal.

2. **Git flyout sem gestão de foco:** Quando o git flyout abre (on hover/focus), o foco não é movido para dentro do flyout. Leitores de tela não saberão que o conteúdo mudou.

3. **Dialog de confirmação não é announced:** O `ConfirmDialog` usa `createPortal` mas não tem `role="alertdialog"` ou `aria-modal="true"`. O leitor de tela pode não detectar que o dialog abriu.

4. **Thread items com `role="button"` em `<div>`:** Isso viola a regra WCAG 4.1.2 de que elementos interativos devem ser botões ou links semanticamente. O `onKeyDown` tratando `Enter` e `Space` é correto, mas a semântica HTML está errada.

5. **Settings menu portal sem gestão de foco:** Quando o settings menu abre, o foco deveria ir para o primeiro item ou para o próprio menu. Atualmente, o foco permanece onde estava.

6. **Ausência de skip links:** Não há "Skip to content" ou "Skip navigation" link no topo do `layout-root`.

### 4.2 ARIA e Leitores de Tela

**O que funciona:**
- `aria-label` em botões de resize do Git panel
- `aria-label` nos botões de archive thread
- `role="status"` nos toasts
- `aria-live` implícito nos toasts via `role="status"`

**Problemas:**

1. **Toasts não têm `aria-live` explícito:** O toast container deveria ter `aria-live="polite"` para leitores de tela anunciarem novas notificações.

2. **Workspace items sem `aria-selected`:** Quando um workspace está ativo, deveria haver `aria-selected="true"` no item correspondente.

3. **Thread count não está em `aria-label`:** O contador de threads (`sb-project-count`) é puramente visual. Usuários de leitor de tela não sabem quantas threads existem em cada workspace.

4. **Update dialog sem `aria-describedby`:** O texto de descrição da atualização deveria ser vinculado ao título via `aria-describedby`.

### 4.3 Contraste e Cores

1. **Texto com `opacity: 0.4` em ícones:** Elementos como chevrons (`ChevronRight`, `ChevronDown`) usam `opacity: 0.4` em `SidebarContent`. Isso pode não atingir taxa de contraste 4.5:1 para texto pequeno.

2. **Texto terciário (`--text-3`):** Não há garantia que `--text-3` atende WCAG AA em todos os contextos de uso.

3. **Indicador de foco em rail:** O rail usa `border: "none"; background: "transparent"`. O foco é visível apenas pelo *outline* padrão do browser, que pode não ser suficiente em backgrounds escuros.

---

## 5. Estados de Erro e Estados Vazios

### 5.1 AppErrorBoundary

```tsx
// AppErrorBoundary.tsx
if (this.state.error) {
  return (
    <div style={{ padding: 16 }}>
      <div className="surface" style={{ padding: 12, borderColor: "var(--danger)" }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{t("app:shared.uiRuntimeError")}</p>
        <pre style={{...}}>{this.state.error.stack ?? this.state.error.message}</pre>
      </div>
    </div>
  );
}
```

**Pontos Positivos:**
- Error boundary global em nível de app
- Mensagem de erro em português e inglês via i18n
- Stack trace visível para debugging

**Problemas:**

1. **Ausência de ação de recovery:** Não há botão "Recarregar" ou "Tentar novamente" após um crash. O usuário precisa reiniciar manualmente.

2. **Sem telemetria:** O erro é apenas logado no console (`console.error("UI crash:", error)`) mas não há evidência de envio a um serviço de error tracking (Sentry, etc.).

3. **Layout improvisado:** O erro é renderizado sem o shell visual do app (sidebar, etc.), o que pode desorientar o usuário.

### 5.2 Estados Vazios (Empty States)

**Sidebar sem workspaces:**
```tsx
<div className="sb-empty">
  {t("app:sidebar.noWorkspaces")}
  <br />
  {t("app:sidebar.openFolder")}
</div>
```

**Terminal vazio:**
```tsx
emptyTitle: "No terminal session"
emptyHint: "Open a new terminal to get started"
```

**Editor vazio:**
```tsx
emptyTitle: "No files open"
emptyHint: "Open a file from the explorer or click a file in the chat"
```

**Pontos Positivos:**
- Mensagens claras e acionáveis em todos os estados vazios principais
- CTAs inline ("Open a folder", "Open a new terminal")
- Traduzidos para PT-BR

**Problemas:**

1. **Editor vazio não mostra atalhos:** Seria útil mostrar `⌘O` para abrir arquivo ou赫然 link para o explorer.

2. **Terminal vazio não indica como criar:** Apenas "Open a new terminal" mas não diz que pode ser via `+` botão ou `⌘T`.

3. **Workspace pane sem workspace:** "Open a workspace to start" não oferece ação direta (deveria haver botão ou link).

### 5.3 Estados de Loading

**HarnessPanel:**
```tsx
{phase === "scanning" && harnesses.length === 0 ? (
  <div className="hp-loading">
    <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
    <p>{t("harnesses.loading")}</p>
  </div>
) : ( ... )}
```

**ToastContainer** usa `Loader2` (spinner) para estados de loading em harnesses.

**Problemas:**

1. **Spinner sem `role="status"` nem `aria-label`:** O ícone `Loader2` de lucide-react não é automaticamente acessível. Deve ter `role="status"` e `aria-label="Carregando..."`.

2. **Skeleton screens ausentes:** Para conteúdo que carrega lentamente (ex: threads, workspaces), não há skeleton screens. Apenas spinner ou texto de loading, o que causa *layout shift* quando o conteúdo chega.

3. **Loading state genérico para diferentes operações:** A mesma mensagem "Loading..." é usada para diferentes operações assíncronas, sem especificar *o que* está carregando.

---

## 6. Onboarding e First-Time Experience

### 6.1 OnboardingWizard (OnboardingWizard.tsx)

O onboarding é gerenciado por uma máquina de estados em `onboardingStore` com funções como `nextOnboardingStep()`, `previousOnboardingStep()`, e `shouldAutoOpenOnboarding()`.

**Fluxo típico:**
1. Primeiro launch detecta que onboarding não foi completado
2. Wizard guide o usuário através de:
   - Seleção de engine (Codex, Claude Code, etc.)
   - Instalação/configuração de dependencies
   - Verificação de saúde do sistema

**Pontos Positivos:**
- State machine bem definida para fluxo de onboarding
- Suporte a `shouldAutoOpenOnboarding()` para auto-start
- Integração com `UpdateDialog` para updates pós-onboarding
- Feedback visual (progress steps, etc.)

**Problemas:**

1. **Ausência de screen reader announcements:** O wizard não usa `aria-live` para anunciar mudanças de passo. Usuários de leitor de tela não sabem que o conteúdo mudou.

2. **Progress bar sem `role="progressbar"`:** O indicador de progresso visual não é exposto como `progressbar` ARIA.

3. **Validação de input não acessível:** Campos de input no wizard (ex: API keys) podem não ter labels corretos, `aria-describedby` para erros, ou mensagens de erro em tempo real.

### 6.2 HarnessPanel

O painel de *agent harnesses* é parte importante do onboarding.

**Pontos Positivos:**
- Grid layout responsivo para cards de harness
- Estados claros: installed, not installed, native
- Ações: Launch, Install, Copy command, Open website
- Loading state com spinner e mensagem

**Problemas:**

1. **Não há empty state se nenhum harness for detectado:** Se a varredura (`scan()`) retornar array vazio, o grid fica vazio sem mensagem informativa.

2. **Rescan button não indica estado:** O botão `hp-rescan` mostra spinner interno quando `phase === "scanning"`, mas não desabilita visualmente durante a varredura (apenas o ícone gira).

3. **Descrição de harnesshardcoded em app.json:** As descrições dos harnesses estão em `app.json` e não há fallback se a chave não existir (apenas `defaultValue: h.description` no `t()`).

---

## 7. Internacionalização (i18n)

### 7.1 Estrutura de Arquivos

```
src/i18n/resources/
├── en/
│   ├── app.json
│   ├── chat.json
│   ├── common.json
│   ├── git.json
│   ├── native.json
│   ├── setup.json
│   └── workspace.json
└── pt-BR/
    ├── app.json
    ├── chat.json
    ├── common.json
    ├── git.json
    ├── native.json
    ├── setup.json
    └── workspace.json
```

**Pontos Positivos:**
- Estrutura completa com 7 namespaces
- 100% de cobertura em pt-BR (arquivos verificados: `app.json` em EN e PT-BR são idênticos em estrutura)
- Uso de interpolação (`{{name}}`, `{{count}}`, `{{version}}`)
- Suporte a pluralização (`one`/`other`)

**Problemas:**

1. **Tradução incompleta no `footer` da command palette:** A chave `navigate` está em minúsculo ("navigate") enquanto outras estão em maiúsculo ("Selecionar", "Abrir"). Isso quebra consistência visual na UI.

2. **Falta de contexto para traduções ambíguas:** A função `t()` é usada sem `t('sidebar.openFolder', { context: 'action' })`, o que pode gerar traduções incorretas para o mesmo texto usado em diferentes contextos.

3. **Números e datas:** Não há evidência de formatação de números/datas específica para locale. `formatRelativeTime` existe em `formatters.ts` mas deve ser verificado se considera locale.

### 7.2 Keys Faltantes

Verificando o `app.json` pt-BR vs EN:
- Estrutura idêntica, todas as keys parecem presentes
- Não há keys de `chat.json` ou `workspace.json` verificadas separadamente
- Hyphens em chaves JSON (`archive-thread-title`) são consistentes

---

## 8. Tema Escuro/Light e Responsividade

### 8.1 Suporte a Tema

O código mostra uso de variáveis CSS (`--accent`, `--bg`, `--text-3`, etc.) que teoricamente permitem temas. Mas:

1. **Não há toggle de tema visível na UI:** Não há Setting ou Command Palette action para trocar entre light/dark mode. O app parece assumir apenas um tema (provavelmente dark baseado nas cores vistas).

2. **Variáveis de tema não definidas no CSS verificado:** O `globals.css` usa variáveis como `--accent`, `--text-3`, `--danger` mas não há definição de tema light alternativo.

### 8.2 Responsividade

O Panes é um **desktop app**, então responsividade no sentido mobile não se aplica. Porém:

1. **Suporte a diferentes tamanhos de janela:** O `content-card` usa `ResizeObserver` para recalcular larguras. O layout de 3 colunas se adapta razoavelmente.

2. **最小宽度 (*min-width*) não definido:** O `layout-root` não tem `min-width`, o que pode causar overflow em janelas muito estreitas.

3. **Focus drag strip:** Existe `focus-drag-strip` para permitir arrastar a janela quando `focusMode` está ativo e não há sidebar. Porém, não há atalho de teclado para ativar focus mode besides command palette.

---

## 9. Fluxo de Usuário e Eficiência

### 9.1 Command Palette como Hub Central

O `⌘K` é o principal mecanismo de navegação. Isso é bom para power users mas pode ser confuso para novos usuários que esperam menus visíveis.

**Sugestão:** Adicionar tooltip nos ícones do rail explicando `⌘K` para Command Palette.

### 9.2 Ações Destrutivas

**Arquivar workspace/thread:**
- Usa `ConfirmDialog` com mensagem explicativa
- Ação é "Arquivar" não "Excluir" (linguagem apropriada)
- Trabalha com archiving (não exclusão permanente)

**Problemas:**
- Arquivar workspace archiva todos os threads e mensagens? A confirmação deveria indicar isso claramente.
- Não há "Desfazer" após archivar.

### 9.3 Performance de Renderização

**Problemas potenciais identificados:**

1. **Sidebar com `useMemo` para `projects`:** A lista de workspaces/threads é recomputada em cada render. Com muitos workspaces, isso pode causar lentidão.

2. **Many `useCallback` hooks:** O `SidebarContent` tem dezenas de `useCallback` para handlers. Isso é bom para estabilidade de referências mas aumenta memory footprint.

3. **ResizeObserver no content card:** O observer persiste durante toda a vida do componente. Não há cleanup visível no código lido (apenas `observer.disconnect()` em cleanup function).

---

## 10. Problemas de UX e Boas Práticas

### 10.1 Problemas de UX Identificados

| # | Problema | Severidade | Local |
|---|----------|------------|-------|
| 1 | Thread items usam `<div role="button">` em vez de `<button>` | Alta | Sidebar.tsx |
| 2 | Flyout da sidebar não é acessível por teclado (sem tab order) | Alta | Sidebar.tsx / CollapsedRail |
| 3 | Settings menu portal não gerencia foco adequadamente | Alta | Sidebar.tsx |
| 4 | Spinners de loading sem `role="status"` ou `aria-label` | Média | HarnessesPanel, ToastContainer |
| 5 | CSS inline abundante mistura apresentação com lógica | Média | Vários componentes |
| 6 | Nomenclatura inconsistente de classes CSS (ex: `ws-toggle` vs `sb-`) | Baixa | globals.css |
| 7 | Valores mágicos de delay (150ms, 200ms) sem documentação | Baixa | ThreeColumnLayout.tsx |
| 8 | Ausência de skip links para navegação por teclado | Alta | layout-root |
| 9 | Toast sem `aria-live="polite"` explícito | Média | ToastContainer.tsx |
| 10 | Empty states não oferecem ações diretas (ex: sem botão em "no workspace") | Média | WorkspacePaneShell |

### 10.2 Boas Práticas Encontradas

1. **Error Boundary em nível de app** com `AppErrorBoundary` wrapping `<App>` em `main.tsx`

2. **Portal para modais** garante que dialogs.Renderizam acima de todo conteúdo

3. **Persisted layout state** em localStorage para preferências do usuário

4. **Zustand stores** para estado global com selectors eficientes

5. **i18n completo** com suporte a pt-BR e en

6. **Keyboard shortcuts** documentados na UI (labels de atalhos visíveis)

7. **ConfirmDialog** para ações destrutivas com mensagens claras

8. **Toast notifications** para feedback assíncrono não-bloqueante

9. **Resizable panels** com limites razoáveis e persistência

10. **Custom window frame** com controles nativos de janela

---

## 11. Recomendações de Melhoria

### Prioridade Alta

1. **Corrigir semântica HTML de thread items:** Trocar `<div role="button">` por `<button>` ou `<a>` semanticamente apropriados.

2. **Adicionar gestão de foco para flyouts e modais:** Quando um flyout/modal abre, mover foco para o primeiro elemento interativo dentro dele. Quando fecha, retornar foco ao elemento que o abriu.

3. **Adicionar skip links:** `<a href="#main-content" class="skip-link">Pular para conteúdo</a>` no topo do layout.

4. **Tornar rail navegável por teclado:** Adicionar `tabIndex={0}` e handlers de teclado aos botões do `CollapsedRail`.

### Prioridade Média

5. **Adicionar skeleton screens:** Para estados de loading de threads, workspaces e arquivos.

6. **Centralizar valores de design em variáveis CSS:** Cores de borda, sombras, opacidades que se repetem devem ser variáveis (`--border-subtle`, `--overlay-bg`, etc.).

7. **Migrar estilos inline para classes CSS:** Especialmente em `SidebarContent` e `ThreeColumnLayout`.

8. **Adicionar `aria-live="polite"` ao toast container:** Ou usar `role="log"` para announcements de leitor de tela.

9. **Adicionar botão de toggle de tema:** Mesmo que seja "dark only" por agora, o controle existir deve estar presente.

10. **Melhorar empty states:** Adicionar CTAs diretos (botões) nos estados vazios em vez de apenas texto.

### Prioridade Baixa

11. **Documentar valores de delay:** Comentar por que 150ms vs 200ms para os timeouts de flyout.

12. **Traduzir "navigate" para "Navegar" no footer da command palette:** Manter consistência de capitalização.

13. **Adicionar search/filter na sidebar:** Para usuários com muitos workspaces.

14. **Considerar collapsible sections para archived items:** Ocultar por padrão até que o usuário expanda explicitamente.

---

## 12. Conclusão

O Panes apresenta uma arquitetura UI bem estruturada com separação clara de concerns (componentes de layout, sidebar, chat, editor, terminal), uso apropriado de state management (Zustand stores), e internacionalização completa. O design system baseado em variáveis CSS e prefixos de classe é organizado.

As principais áreas de melhoria concentram-se em **acessibilidade**: navegação por teclado em trilhos/colapsos, gestão de foco em modais e flyouts, e uso de elementos HTML semânticos. Questões secundárias incluem o uso excessivo de estilos inline, a falta de skeleton screens para estados de loading, e a ausência de controles de tema.

O app demonstra atenção a detalhes de UX como confirmation dialogs para ações destrutivas, keyboard shortcuts visíveis, e feedback de toast para operações assíncronas. A qualidade geral da implementação UI é sólida, com as correções de acessibilidade sendo o próximo passo mais impactante.

---

*Relatório gerado como parte da análise de UI/UX do Panes.*
*Este documento é confidencial e destinado apenas para fins de desenvolvimento.*
