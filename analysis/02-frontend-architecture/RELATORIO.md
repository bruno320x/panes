# Relatório de Análise da Arquitetura Frontend do Panes

## 1. Visão Geral da Arquitetura

O Panes é uma aplicação React 19 + TypeScript + Vite que utiliza **Zustand** para gerenciamento de estado. A arquitetura segue um padrão de stores modulares com comunicação via IPC (Inter-Process Communication) com o processo principal Electron.

### Stack Tecnológico
- **Framework UI**: React 19 com TypeScript
- **Build Tool**: Vite
- **Gerenciamento de Estado**: Zustand (14 stores identificadas)
- **Comunicação**: IPC layer abstrata em `src/lib/ipc`
- **Componentes de Layout**: `react-resizable-panels`
- **I18n**: `react-i18next`

---

## 2. Análise dos Stores Zustand

### 2.1 Inventário de Stores

| Store | Arquivo | Responsabilidade |
|-------|---------|-----------------|
| `workspaceStore` | `stores/workspaceStore.ts` | workspaces, repos, trust levels |
| `chatStore` | `stores/chatStore.ts` | threads, mensagens, streaming |
| `threadStore` | `stores/threadStore.ts` | CRUD de threads, archives |
| `chatComposerStore` | `stores/chatComposerStore.ts` | runtime do compositor por workspace |
| `engineStore` | `stores/engineStore.ts` | engines, health checks |
| `terminalStore` | `stores/terminalStore.ts` | sessões de terminal, layout |
| `fileStore` | `stores/fileStore.ts` | abas do editor, arquivos abertos |
| `gitStore` | `stores/gitStore.ts` | status git, branches, commits, stash |
| `uiStore` | `stores/uiStore.ts` | UI state, sidebar, focus mode |
| `toastStore` | `stores/toastStore.ts` | sistema de notificações toast |
| `harnessStore` | `stores/harnessStore.ts` | onboarding harnesses |
| `keepAwakeStore` | `stores/keepAwakeStore.ts` | gestão de energia |
| `onboardingStore` | `stores/onboardingStore.ts` | estado de onboarding |
| `updateStore` | `stores/updateStore.ts` | updates de aplicação |
| `terminalNotificationSettingsStore` | `stores/terminalNotificationSettingsStore.ts` | settings de notificação |
| `workspacePaneStore` | `stores/workspacePaneStore.ts` | layout de painéis |

### 2.2 Padrões de Store Identificados

#### ✅ Padrões Positivos

**a) Separação Clara de Responsabilidades**
Cada store tem uma responsabilidade única e bem definida:
- `toastStore`: apenas notificações
- `chatComposerStore`: runtime state
- `uiStore`: estado puramente de UI

**b) Tipagem Forte com TypeScript**
Todos os stores utilizam interfaces/ tipos TypeScript para definir o shape do estado e das ações:
```typescript
interface EngineState {
  engines: EngineInfo[];
  health: Record<string, EngineHealth>;
  healthLoading: Record<string, boolean>;
  loading: boolean;
  loadedOnce: boolean;
  error?: string;
  load: () => Promise<void>;
  // ...
}
```

**c) Uso de Selectors na Store**
Os componentes utilizam selectors diretos do Zustand:
```typescript
const showSidebar = useUiStore((state) => state.showSidebar);
const sidebarPinned = useUiStore((state) => state.sidebarPinned);
```

**d) Caching e Deduplicação de Requests**
- `gitStore`: implementa caching sofisticado com TTL, LRU, e deduplicação de requests in-flight
- `engineStore`: mantém `pendingHealthRequests` para evitar múltiplas chamadas simultâneas

#### ⚠️ Padrões de Atenção

**a) Armazenamento em Módulos (Module State)**
Alguns stores utilizam estado em nível de módulo (não no store Zustand):
```typescript
// gitStore.ts
const repoRevisionByPath = new Map<string, number>();
const statusCacheByRepo = new Map<string, GitStatusCacheEntry>();
const statusInFlightByRepo = new Map<string, Promise<GitStatus>>();
```
**Impacto**: Este estado não é serializável, não pode ser inspecionado pelo Redux DevTools (se houvesse), e pode causar memory leaks se não for limpo adequadamente.

**b) Store de Toast com Módulos**
O `toastStore` utiliza `let nextId = 0` em nível de módulo:
```typescript
let nextId = 0;
```
**Impacto**: Pode causar problemas em hot-reload e testes.

**c) Conversões StringtoError em Catch Blocks**
```typescript
} catch (error) {
  set({ error: String(error) });
  return null;
}
```
**Impacto**: Perda de stack traces e informação de erro.

### 2.3 Store Mais Complexo: `gitStore`

O `gitStore` é o store mais robusto com ~700+ linhas:

**Funcionalidades**:
- Cache de status git (TTL-based, LRU com limites de bytes)
- Cache de diffs com TTL
- Paginação de branches e commits
- Worktrees, stashes, remotes
- Drafts de commit salvos em localStorage

**Métricas de Cache**:
```
GIT_STATUS_CACHE_TTL_MS = 1_000
GIT_DIFF_CACHE_TTL_MS = 1_200
GIT_STATUS_CACHE_MAX_BYTES = 3MB
GIT_DIFF_CACHE_MAX_BYTES = 24MB
GIT_STATUS_CACHE_MAX_ENTRIES = 32
GIT_DIFF_CACHE_MAX_ENTRIES = 320
```

---

## 3. Análise de Componentes

### 3.1 Estrutura de Componentes

```
src/components/
├── chat/           # Chat, mensagens,Composer
├── editor/         # Editor de código, explorer
├── git/            # Painel Git, visualizações
├── layout/         # Layout principal (ThreeColumnLayout)
├── onboarding/     # Wizard, harnesses
├── shared/         # Componentes partilhados
├── sidebar/        # Sidebar
├── terminal/       # Terminal
└── workspace/      # Settings, startup
```

### 3.2 Padrões de Composição

#### ✅ Uso de Context API para Flyouts
O `ThreeColumnLayout` utiliza `GitFlyoutContext` para comunicar estado do flyout:
```typescript
const gitFlyoutContextValue = useMemo(
  () => ({
    openFlyout: openGitFlyout,
    scheduleClose: closeGitFlyout,
    isTargetWithinRegion: (target: EventTarget | null) =>
      isTargetWithinGitFlyoutRegion(target, [gitFlyoutRef.current, gitTriggerRef.current]),
  }),
  [closeGitFlyout, openGitFlyout],
);
```

#### ✅ Hooks Customizados para Lógica
O `ThreeColumnLayout` extrai lógica para hooks como `useCallback` para event handlers.

#### ⚠️ Ausência de `React.memo` em Componentes
A pesquisa mostrou **377 ocorrências** de `useMemo`/`useCallback`, mas nenhuma utilização de `React.memo` nos componentes principais. Isso pode causar re-renders desnecessários em componentes filhos quando o estado pai muda.

### 3.3 Prop Drilling

**NÍVEL MODERADO DE PROP DRILLING**

Exemplo em `ThreeColumnLayout`:
```typescript
const showSidebar = useUiStore((state) => state.showSidebar);
const sidebarPinned = useUiStore((state) => state.sidebarPinned);
const toggleSidebarPin = useUiStore((state) => state.toggleSidebarPin);
const showGitPanel = useUiStore((state) => state.showGitPanel);
```

Os valores são usados diretamente no JSX sem drilling através de props, o que é **bom**. Porém, em componentes mais profundos, pode haver drilling.

---

## 4. Análise de Re-renders

### 4.1 Problemas Identificados

**a) Zustand Selector Returnando Objetos**
O código evita retornar objetos literais diretamente dos selectors:
```typescript
// ✅ BOM - selector retorna primitivo
const showSidebar = useUiStore((state) => state.showSidebar);

// ⚠️ POTENCIAL PROBLEMA se fosse assim:
// const state = useUiStore((state) => ({ show: state.showSidebar }));
// Isso causaria re-render a cada chamada pois {} !== {}
```

**b) Ausência de `React.memo`**
Componentes como `Sidebar`, `GitPanel`, `TerminalPanel` não parecem estar envoltos em `React.memo`, potencialmente causando re-renders desnecessários.

**c) Memoização Seletiva no `ThreeColumnLayout`**
O `gitFlyoutContextValue` é memoizado, mas muitos callbacks são recriados em cada render:
```typescript
const clearGitFlyoutCloseTimer = useCallback(() => { ... }, []);
```
Este é o padrão correto, mas callbacks com dependências podem ser fonte de re-renders se as dependências mudarem frequentemente.

---

## 5. Análise de Type Safety

### 5.1 Resultados da Pesquisa

**`as any`: 0 ocorrências**
**`as unknown`: 0 ocorrências**

### 5.2 Avaliação

✅ **EXCELENTE** - Não foram encontradas utilizações de type assertions perigosas (`as any`, `as unknown`). O código utiliza tipagem estrutural adequada e interfaces TypeScript bem definidas.

### 5.3 Pontos de Atenção

**a) Uso de `satisfies` em Alguns Lugares**
```typescript
} satisfies Partial<GitState>;
```
O uso de `satisfies` é positivo pois valida tipos em tempo de compilação sem mudar o tipo inferido.

**b) Errors Convertidos para Strings**
```typescript
} catch (error) {
  set({ error: String(error) });
}
```
Perda de tipo - um `Error` object pode conter informações úteis.

---

## 6. Análise de Performance

### 6.1 Otimizações Positivas

**a) ResizeObserver para Dimensões**
```typescript
useEffect(() => {
  const contentCard = contentCardRef.current;
  if (!contentCard) return;
  
  const updateWidth = () => {
    setContentCardWidth(contentCard.getBoundingClientRect().width);
  };
  
  updateWidth();
  const observer = new ResizeObserver(updateWidth);
  observer.observe(contentCard);
  return () => observer.disconnect();
}, []);
```

**b) LocalStorage com Try-Catch**
Todas as operações de localStorage são envolvidas em try-catch:
```typescript
try {
  localStorage.setItem(SIDEBAR_PINNED_KEY, String(next));
} catch {
  // Ignore storage failures in non-browser/test environments.
}
```

**c) Debounce Implícito no Git Store**
O cache TTL de 1s para status git reduz chamadas excessivas.

### 6.2 Oportunidades de Melhoria

**a) Falta de `React.memo`**
Componentes que recebem callbacks ou objetos como props podem se beneficiar de `React.memo`.

**b) Zustand Transações**
Stores que fazem múltiplas operações `set()` seguidas podem agrupá-las para evitar re-renders intermediários.

**c) Virtualização**
Não foi encontrada implementação de janelas virtualizadas (ex: `react-window`, `react-virtualized`) para listas longas de arquivos ou mensagens.

---

## 7. Análise de Code Organization

### 7.1 Estrutura de Diretórios

```
src/
├── components/     # Componentes React
│   ├── chat/
│   ├── editor/
│   ├── git/
│   ├── layout/
│   ├── onboarding/
│   ├── shared/
│   ├── sidebar/
│   ├── terminal/
│   └── workspace/
├── stores/         # Zustand stores
├── lib/            # Utilitários (ipc, fileRootUtils, etc.)
├── i18n/           # Internacionalização
├── types.ts        # Definições de tipos globais
├── App.tsx          # Entry point principal
└── main.tsx         # Bootstrap
```

### 7.2 Separação de Concerns

✅ **BEM SEPARADO**:
- Stores: estado e lógica de negócio
- Components: apenas apresentação
- Lib: utilitários e helpers
- Types: contratos TypeScript

### 7.3 Padrões de Imports

O código utiliza imports relativos consistentes:
```typescript
import { useUiStore } from "../../stores/uiStore";
import { ipc } from "../lib/ipc";
```

---

## 8. Testes

### 8.1 Cobertura de Testes

A pesquisa encontrou arquivos de teste em `*.test.ts*`. A estrutura sugere uma suíte de testes presente, mas não foi possível analisar a cobertura específica sem acesso ao conteúdo dos arquivos de teste.

### 8.2 Observações

- Os stores têm lógica complexa que seria difícil de testar sem mocks de `localStorage` e `ipc`.
- A ausência de `as any` é positiva para estabilidade dos tipos em refactorings.

---

## 9. Problemas e Recomendações

### 9.1 Problemas de Alta Prioridade

**1. Module State em gitStore**
O estado de cache em nível de módulo não é gerenciado pelo Zustand e pode causar memory leaks.

*Recomendação*: Considerar mover para o estado do store ou um sistema de cache dedicado.

**2. Conversão de Erros para Strings**
```typescript
} catch (error) {
  set({ error: String(error) });
}
```

*Recomendação*: Manter objetos de erro originais quando possível:
```typescript
} catch (error) {
  set({ error: error instanceof Error ? error.message : String(error) });
}
```

### 9.2 Problemas de Média Prioridade

**3. Ausência de `React.memo`**
Componentes como `Sidebar`, `GitPanel` podem re-render desnecessariamente.

*Recomendação*: Envolver componentes folhas em `React.memo`.

**4. Nenhuma Virtualização em Listas**
Listas longas (mensagens, arquivos) podem causar performance issues.

*Recomendação*: Avaliar `react-window` para listas com >100 items.

### 9.3 Problemas de Baixa Prioridade

**5. Toast Store com `let nextId` em Módulo**
```typescript
let nextId = 0;
```

*Recomendação*: Mover para o estado do store ou usar `crypto.randomUUID()`.

**6. Console Logs Não Observados**
Diversos blocos `catch` têm apenas `// Ignore` comments.

*Recomendação*: Considerar adicionar logging em ambiente de desenvolvimento.

---

## 10. Conclusão

A arquitetura frontend do Panes demonstra **qualidade acima da média** com:

✅ **Pontos Fortes**:
- Stores bem separados e tipados
- Zero uso de `as any` ou `as unknown`
- Separação clara de concerns
- Padrões consistentes de código
- Caching sofisticado em stores críticos (gitStore)

⚠️ **Áreas de Melhoria**:
- Module state não-Zustand pode causar memory leaks
- Falta de `React.memo` em componentes
- Conversão de erros para strings
- Ausência de virtualização para listas grandes

A arquitetura é escalável e manutenível, adequada para uma aplicação desktop complexa como o Panes.

---

*Relatório gerado em: $(date)*