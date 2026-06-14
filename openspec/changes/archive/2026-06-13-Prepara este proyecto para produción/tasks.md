# Tasks: Prepara este proyecto para produción

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Phase 1: CI & Release Workflows

- [x] 1.1 Create `.github/workflows/release.yml`: tag-triggered `cargo tauri build` + GH Release uploading .deb, .AppImage, .dmg
- [x] 1.2 Add `audit` job to `.github/workflows/ci.yml`: `npm audit` + `cargo install cargo-audit && cargo audit`
- [x] 1.3 Create `.github/workflows/audit-weekly.yml`: cron Monday, runs `npm audit` + `cargo audit`, with `--ignore` for documented advisories

## Phase 2: Error Logging (Rust backend)

- [x] 2.1 [RED] Write Rust test: `catch_unwind` on panicking closure, verify `error.log` contains backtrace
- [x] 2.2 Add `OnceLock<PathBuf>` set in `setup()`, `panic::set_hook`, write to `{app_data_dir}/error.log` with 1MB cap + 5-entry session limit
- [x] 2.3 [RED] Write Rust test: `write_error_log` command appends to tempdir file with correct content
- [x] 2.4 Add `#[tauri::command] fn write_error_log(message: String, stack: Option<String>)` to `lib.rs`

## Phase 3: Error Logging (Frontend)

- [x] 3.1 [RED] Write TS test: ErrorBoundary `componentDidCatch` calls `invoke('write_error_log')` with error + stack
- [x] 3.2 Add `componentDidCatch` to `src/ErrorBoundary.tsx`: dynamic `import('@tauri-apps/api/core')` → `invoke('write_error_log', { message, stack })`

## Phase 4: Build Optimization

- [x] 4.1 Add `manualChunks: { 'react-vendor': ['react', 'react-dom'] }` to `vite.config.ts` build.rollupOptions.output
- [x] 4.2 Add `rollup-plugin-visualizer` dev dep + `"analyze": "vite build --config vite.config.ts --mode analyze"` script to `package.json`

## Phase 5: Documentation

- [x] 5.1 Create `DEPLOYMENT.md`: build prereqs per platform, `npm run tauri build`, release tag workflow, `npm run analyze` usage
