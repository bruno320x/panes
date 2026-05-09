# Production hardening TODO

Date: 2026-05-09

## Done

- [x] Restore `master` from the healthy `fix/ci-skills-typecheck` lineage and apply the copied incoming changes.
- [x] Create isolated hardening branch/worktree for production fixes.
- [x] Run Graphify AST extraction and Socraticode graph analysis.
- [x] Remove duplicated skills modal rendering.
- [x] Localize skills panel copy and replace text close/add icons with Lucide icons.
- [x] Make standalone MCP commands honest instead of returning fake successful results.
- [x] Pass the active workspace root into skill scanning.
- [x] Fix provider/category metadata for scanned skills.
- [x] Remove the `workspaceStore`/`terminalStore` circular dependency.
- [x] Fix stale Rust DB test fixtures.
- [x] Resolve npm production vulnerabilities.
- [x] Add Android build scripts.
- [x] Document audit, gaps, and Android APK path.

## Final Validation Before Shipping

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm audit --omit=dev`
- [x] `cargo fmt -- --check`
- [x] `cargo check`
- [x] `cargo test`
- [x] `npm run check:codex-schema` with CI-pinned `@openai/codex@0.125.0` generated schema.
- [x] `npm run android:build` attempted; blocked by missing generated Android project.
- [x] `npm run android:init` attempted; blocked by missing Android SDK/NDK environment.

## Next Product Backlog

- [ ] Build a real MCP manager:
  - [ ] Read/write project and global MCP config files.
  - [ ] Validate stdio, SSE, Streamable HTTP, and OAuth-based server configs.
  - [ ] Show command, args, env requirements, config source, and transport before install.
  - [ ] Start/stop servers through a real MCP client runtime.
  - [ ] List tools/resources per server and allow per-tool toggles.
  - [ ] Add install logs, health checks, and rollback/remove.
- [ ] Build one-click skill installation:
  - [ ] Scaffold `.skills/<slug>/SKILL.md` inside the active workspace.
  - [ ] Import skills from local folders, URLs, or a registry.
  - [ ] Preview skill content and destination before writing files.
  - [ ] Add refresh and reveal-in-file-manager actions.
- [ ] Improve long-running agent orchestration:
  - [ ] Add visible task plans/todos per agent run.
  - [ ] Allow queued messages while an agent is busy.
  - [ ] Add named checkpoints and revert UX.
  - [ ] Persist multi-agent orchestration state.
- [ ] Improve frontend performance:
  - [ ] Split the main Vite bundle into route/tool chunks.
  - [ ] Lazy-load terminal, Markdown, and heavy editor paths more aggressively.
  - [ ] Add bundle size budget checks to CI.
- [ ] Tighten desktop security:
  - [ ] Add a restrictive Tauri CSP.
  - [ ] Validate Markdown/raw HTML behavior under the CSP.
  - [ ] Add permission and path validation for reading skill content.
- [ ] Add Android CI once the Android project exists:
  - [ ] Cache Gradle/Rust/Node dependencies.
  - [ ] Build debug APK on Linux.
  - [ ] Build signed release artifacts only from protected release workflows.
