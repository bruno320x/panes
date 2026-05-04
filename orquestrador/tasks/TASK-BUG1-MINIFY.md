# TASK-BUG1: Corrigir minify: false no Vite

## Bug
- **Severidade:** 🔴 Crítica
- **Arquivo:** `vite.config.ts`
- **Problema:** `minify: false` no Vite faz build de produção SEM minificação

## Passos

1. Localize o arquivo `vite.config.ts` na raiz do projeto
2. Encontre a linha com `minify: false` ou `minify: true`
3. Se `minify: false`: mude para `minify: true` OU remova a linha (true é default)
4. Verifique se há outras instâncias com grep
5. Commit: `fix(performance): enable minification in Vite production build`

## Ferramentas
- Use `terminal` para grep e editar
- Use `patch` para substituição direta

## Verificação
```bash
grep -n "minify" vite.config.ts
```

## Critério de Sucesso
- `minify: false` removido ou alterado para `true`
- Commit realizado
