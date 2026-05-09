# Production readiness audit

Date: 2026-05-09

## Scope

This audit covered the current `master` state after the incoming UI/MCP updates were applied. The review used:

- Serena for code navigation and symbol-level inspection.
- Socraticode for dependency graph analysis.
- Graphify AST extraction for a broader repo map.
- Local validation with TypeScript, Vitest, Rust formatting/checks/tests, npm audit, Vite build, and Android build attempts.
- External product benchmarking from official docs:
  - Tauri prerequisites and Android distribution: https://v2.tauri.app/start/prerequisites/ and https://v2.tauri.app/distribute/
  - Cursor MCP CLI: https://docs.cursor.com/cli/mcp
  - Windsurf Cascade and MCP: https://docs.windsurf.com/windsurf/cascade/cascade and https://docs.windsurf.com/windsurf/cascade/mcp
  - Cline MCP Marketplace: https://docs.cline.bot/mcp/mcp-marketplace
  - Roo Code docs: https://docs.roocode.com/

## Findings Fixed In This Pass

- `ChatPanel` rendered `SkillsPanel` twice for the same `showSkillsPanel` state. This could create duplicate modal overlays and focus behavior. The panel now renders once at the root overlay level.
- The frontend carried unused `EngineFeatureRenderer` and `engineFeatures` code in `ChatPanel`. Removed the dead path.
- Standalone MCP Tauri commands returned fake success and empty payloads for start/stop/list/call/read operations. They now fail explicitly with a clear "not implemented" message, while runtime MCP diagnostics remain available through Codex/OpenCode engine health.
- The skills scanner used the process current directory instead of the active workspace root. `SkillsPanel` now passes the active workspace root through the frontend service to the Tauri scanner.
- The skills scanner derived `provider` and `category` from the parent folder name, which broke custom skill metadata. It now preserves the requested provider/category and marks custom skills as non-native.
- The `workspaceStore`/`terminalStore` static cycle was removed. Shared active repo selection moved to `src/lib/workspaceSelection.ts`, and terminal state keeps the workspace root passed during workspace activation.
- Rust DB test fixtures were constructing `ConnectionPool` manually and missed newer fields. They now use `Database::open`.
- npm production audit now resolves to zero vulnerabilities by updating Claude/release tooling and overriding `@anthropic-ai/sdk` to a non-vulnerable range.
- The skills panel now uses i18n strings for user-facing copy and Lucide icons for modal actions instead of hardcoded Portuguese copy and text glyphs.
- Android scripts were added to `package.json`: `android:init`, `android:dev`, and `android:build`.

## Product Gaps Still Not Production-Complete

- Full one-click MCP installation is not implemented yet. The existing app can inspect engine runtime diagnostics, but it does not persist, install, validate, or launch arbitrary MCP servers.
- Full one-click skill installation is not implemented yet. The app scans workspace/global skill folders and toggles local preferences, but it does not yet scaffold or import skills from a registry.
- MCP security review is required before installing third-party servers. Marketplace-style installs should include trust/source display, required env vars, command preview, dependency/build step preview, and per-tool enablement.
- Android APK generation requires a local Android toolchain and generated Tauri Android project. The repo now has scripts and documentation, but this environment did not have the required SDK variables configured.
- Vite still warns that the main JS chunk is larger than 500 kB. This is a performance backlog item, not a correctness failure.
- Tauri CSP is currently permissive in config. Tightening it should be done with browser regression testing because the app renders Markdown, local assets, Tauri protocols, and worker chunks.

## Competitive Ideas Worth Building Next

- Cline-style MCP marketplace: searchable catalog, install button, secure env var flow, install confirmation, and status verification.
- Windsurf-style tool controls: show MCP tools per server and let the user enable/disable specific tools; also add limits and warnings when too many tools are exposed.
- Cursor-style MCP CLI parity: expose server status, transport, source, and `list-tools` equivalents directly in the UI.
- Windsurf-style task handling: visible todo list for long agent work, queued user messages while an agent is running, and named checkpoints/reverts for generated edits.
- Roo/Cline-style project-level MCP config: support committed project MCP files separately from user-global MCP config.

## Verification Snapshot

Commands run successfully during this pass:

- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `cargo fmt -- --check`
- `cargo check`
- `cargo test`
- `npx -y @openai/codex@0.125.0 codex app-server generate-json-schema --out <tmp> && npm run check:codex-schema -- --schema-dir <tmp>`

Notes:

- `cargo test` initially failed due stale DB test fixtures; this pass updates those fixtures.
- The local `codex` binary is `0.130.0-alpha.5` and generates a schema that is not compatible with the repo check. The CI-pinned `@openai/codex@0.125.0` schema check passes.
- `npm run android:init`/`npm run android:build` are blocked here by a missing Android SDK/NDK toolchain; see `docs/android-apk.md`.
