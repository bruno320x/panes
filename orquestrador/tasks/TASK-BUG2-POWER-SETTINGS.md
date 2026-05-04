# TASK-BUG2: Corrigir setPowerSettings tipo errado

## Bug
- **Severidade:** 🟡 Moderada
- **Arquivo:** `src-tauri/src/commands/power.rs`
- **Problema:** `set_power_settings` retorna `KeepAwakeStateDto` mas deveria retornar `PowerSettingsDto`

## Passos

1. Use `mcp_serena_find_symbol` para localizar `set_power_settings` em `power.rs`
2. Verifique a assinatura da função e tipo de retorno atual
3. Altere o retorno de `KeepAwakeStateDto` para `PowerSettingsDto`
4. Verifique se há `#[tauri::command]` endpoint correspondente
5. Commit: `fix(power): correct return type for set_power_settings`

## Ferramentas
- Use `mcp_serena_find_symbol` para localização precisa
- Use `read_file` para verificar contexto
- Use `patch` para edição

## Critério de Sucesso
- Tipo de retorno corrigido para `PowerSettingsDto`
- Código compila (verifique com `cargo check`)
- Commit realizado
