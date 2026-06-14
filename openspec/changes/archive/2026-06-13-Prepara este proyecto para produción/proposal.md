# Proposal: Production Readiness

## Intent

Foundations exist (CI, app decomposition, zod, ErrorBoundary). Missing: release automation, dependency auditing, error observability, build optimization, deployment docs — the layers that ship a desktop binary.

## Scope

### In Scope
- GitHub Release: Tauri bundles on tag push
- `npm audit` + `cargo audit` in CI (PR + weekly)
- Rust panic hook + frontend errors → log file
- Vite code splitting + bundle visualizer
- `DEPLOYMENT.md` with build instructions

### Out of Scope
- Code signing/notarization (needs Apple account)
- Auto-updater (server infra deferred)
- Cloud crash reporting (Sentry — overkill)
- E2E / integration tests

## Capabilities

### New Capabilities
- `release-pipeline`: GitHub Release building .deb/.AppImage on tag push
- `error-reporting`: Rust panic_hook + ErrorBoundary persist errors to file
- `dependency-auditing`: npm + cargo audit on PRs and weekly schedule

### Modified Capabilities
- None — all existing specs are stable

## Approach

| Item | Strategy |
|------|----------|
| Release | `.github/workflows/release.yml`: tag push → `cargo tauri build` → upload → Release |
| Auditing | Add audit jobs to `ci.yml`; separate `audit-weekly.yml` on cron |
| Observability | Rust: `panic::set_hook` → `app_data_dir/error.log`; Frontend: ErrorBoundary → IPC write |
| Build opt | Vite `manualChunks` for react vendor; `rollup-plugin-visualizer` for CI stats |
| Docs | `DEPLOYMENT.md`: prereqs, `npm run tauri build`, release tags, platform notes |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.github/workflows/ci.yml` | Modified | Add audit jobs |
| `.github/workflows/release.yml` | New | Release pipeline |
| `.github/workflows/audit-weekly.yml` | New | Weekly vuln scan |
| `src-tauri/src/lib.rs` | Modified | Panic hook |
| `src/ErrorBoundary.tsx` | Modified | Persist errors to file |
| `vite.config.ts` | Modified | manualChunks + visualizer |
| `package.json` | Modified | audit/analyze scripts |
| `DEPLOYMENT.md` | New | Build & release guide |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cargo audit false positives | Med | `--ignore` in CI, manual PR review |
| Release OS mismatch | Low | Dry-run on ubuntu-latest first |
| Error log disk growth | Low | Rotate at 1MB, cap 5 entries/session |

## Rollback Plan

Per-item revert: `git revert` each workflow, error hook, config change. Delete `DEPLOYMENT.md`.

## Dependencies

- `cargo-audit` (install in CI: `cargo install cargo-audit`)
- `rollup-plugin-visualizer` (npm dev dep)

## Success Criteria

- [ ] Tag push creates GitHub Release with `.deb` + `.AppImage` + `.dmg`
- [ ] CI fails on PR with vulnerable npm/cargo dependency
- [ ] Rust panic writes `{app_data_dir}/error.log` with backtrace
- [ ] `vite build` splits react vendor into separate chunk
- [ ] `DEPLOYMENT.md` covers Linux, macOS, Windows build steps
