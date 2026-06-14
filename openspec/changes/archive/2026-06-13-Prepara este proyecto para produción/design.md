# Design: Production Readiness — Release, Auditing, Error Logging, Build Opts, Deploy Docs

## Technical Approach

Five independent deliverables, each a minimal production layer. No architectural refactors — only additive workflows, hooks, and config changes. Maps directly to the proposal's five items; each has a matching spec in `openspec/specs/`.

## Architecture Decisions

### Release: Separate workflow vs. extend CI

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extend `ci.yml` with release job | One workflow file, but release has different trigger (tag) and permissions | **Separate `.github/workflows/release.yml`** |
| `tauri-action` vs. manual steps | Action simplifies but adds coupling; manual is explicit | **Manual `cargo tauri build` + `softprops/action-gh-release`** |

### Error logging: `OnceLock` path + single IPC command

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `dirs::data_dir()` at hook init | Works pre-Tauri-init but doesn't use Tauri's path API | **`OnceLock<PathBuf>` set in Tauri `setup()` hook** |
| One IPC command per log vs. generic | Generic is reusable | **Single `write_error_log` command for frontend** |
| Rolling file vs. single file capped | Both work; single + cap is simpler | **Single file, 1MB cap, 5-entries/session limit** |

### Build optimization: manualChunks

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extract react only | Safe — react is the only large vendor dep | **`manualChunks` with one `react-vendor` chunk** |
| Extract all `node_modules` | Over-splitting increases request count | Rejected — react-only is sufficient |

## Data Flow

```
Release flow:
  git push v* → release.yml → cargo tauri build → .deb/.AppImage/.dmg → GitHub Release

Error flow (Rust):
  panic!() → panic::set_hook → OnceLock<PathBuf> → append to error.log

Error flow (Frontend):
  React render crash → ErrorBoundary.getDerivedStateFromError → invoke('write_error_log') → Rust command → error.log

Dep audit flow:
  PR push / cron → audit job → cargo audit + npm audit → pass/fail status
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/release.yml` | Create | Tag-triggered Tauri build + GitHub Release |
| `.github/workflows/audit-weekly.yml` | Create | Cron-based npm + cargo audit every Monday |
| `.github/workflows/ci.yml` | Modify | Add `audit` job (npm audit + cargo audit) |
| `src-tauri/src/lib.rs` | Modify | Panic hook in `run()`, new `write_error_log` command |
| `src/ErrorBoundary.tsx` | Modify | Add `componentDidCatch` → `invoke('write_error_log')` |
| `vite.config.ts` | Modify | Add `rollupOptions.output.manualChunks` for react vendor + visualizer plugin |
| `package.json` | Modify | Add `"analyze"` script for bundle visualizer |
| `DEPLOYMENT.md` | Create | Build prereqs, platform notes, release workflow |

## Interfaces / Contracts

### New Tauri IPC command (lib.rs)

```rust
#[tauri::command]
fn write_error_log(message: String, stack: Option<String>) -> Result<(), String>;
```

### Panic hook signature (lib.rs)

```rust
std::panic::set_hook(Box::new(|panic_info: &std::panic::PanicHookInfo| {
    let msg = /* format panic info */;
    append_to_error_log(&msg);
}));
```

### ErrorBoundary change (ErrorBoundary.tsx)

```typescript
componentDidCatch(error: Error, info: React.ErrorInfo) {
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('write_error_log', {
      message: error.message,
      stack: error.stack ?? null,
    }).catch(() => {});  // fire-and-forget, no render-blocking
  });
}
```

### manualChunks config (vite.config.ts)

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
      },
    },
  },
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (Rust) | `write_error_log` command — appends to temp file | `cargo test` with tempdir, verify file content |
| Unit (Rust) | Panic hook fires and writes | `std::panic::catch_unwind` on a panicking closure, verify log file |
| Lint | `npm audit` + `cargo audit` run without error on current deps | CI will catch on first run |
| Manual | Release workflow on tag push | Create `v0.1.0-rc1` tag on a branch, verify release is created |

## Migration / Rollout

No migration required. All changes are additive and independently revertible:
- Revert workflow files → remove YAML
- Revert `lib.rs` → `git revert` the commit
- Delete `DEPLOYMENT.md`

## Open Questions

- None. The designs are straightforward and all prior decisions are resolved.
