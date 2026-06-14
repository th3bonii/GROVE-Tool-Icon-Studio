# Proposal: Fix Startup Crash and Slowness

## Intent

The app crashes on startup because `get_icon_thumbnails` is a **synchronous** Tauri command that reads 300+ PNGs from WSL and base64-encodes them, blocking the main thread for 15-20s. The OS kills the unresponsive process. Two sequential sync commands (`list_installed_icons` + `get_icon_thumbnails`) make startup painfully slow.

## Scope

### In Scope
- Convert `get_icon_thumbnails` from sync to `async fn` with `tokio::task::spawn_blocking` for file I/O
- Convert `list_installed_icons` from sync to `async fn` with `spawn_blocking`
- Return proper `Result` type from `get_icon_thumbnails` (currently bare `HashMap`, panics on error)
- Fix unhandled promise rejection in `InstallSection.tsx` thumbnail `useEffect`
- Update `api.ts` `getIconThumbnails` to use `safeInvoke` + Zod schema

### Out of Scope
- Lazy-loading thumbnails via IntersectionObserver (deferred perf work)
- Converting other sync commands (`install_icon`, `delete_icon`, `get_icon_strip`, `write_file`) — no crash risk
- Architectural decomposition of `installer.rs`
- UI loading states or skeleton screens

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `icon-manager`: `get_icon_thumbnails` changes from sync/no-Result to async/Result — spec must document error scenarios
- `icon-manager`: `list_installed_icons` changes from sync to async — no behavioral change, tests need async update

## Approach

1. **lib.rs**: Change `get_icon_thumbnails` and `list_installed_icons` — add `async fn`, wrap file I/O in `spawn_blocking`, return `Result<HashMap<String, String>, String>`.
2. **installer.rs**: Keep `get_icon_thumbnails` helper sync (pure file reads). The async boundary lives in the Tauri command, not the helper.
3. **api.ts**: Replace raw `invoke` in `getIconThumbnails` with `safeInvoke` + `z.record(z.string(), z.string())`.
4. **InstallSection.tsx**: Add `.catch()` or try/catch around the `load()` promise in the thumbnail effect.
5. **Tests**: `list_installed_icons` test moves from `#[test]` to `#[tokio::test]`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/src/lib.rs` | Modified | 2 sync commands → async (lines 199-226) |
| `src-tauri/src/installer.rs` | Unchanged | Helper stays sync, called via spawn_blocking |
| `src/api.ts` | Modified | `getIconThumbnails` → safeInvoke (lines 216-227) |
| `src/sections/InstallSection.tsx` | Modified | Add error handling to thumbnail effect (lines 97-113) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Async change breaks IPC contract | Low | Frontend already uses `safeInvoke` for most commands — same pattern |
| `spawn_blocking` runtime unavailable | Low | Already used by `process_icon` / `preview_icon` — proven pattern |
| `getIconThumbnails` errors surface to user | Med | New error surface — frontend must handle gracefully without cascading |

## Rollback Plan

Revert `lib.rs` signatures for `list_installed_icons` and `get_icon_thumbnails` to sync. Revert `api.ts` to raw `invoke`. Revert `InstallSection.tsx` to previous effect. `installer.rs` unchanged — zero risk on rollback.

## Dependencies

None

## Success Criteria

- [ ] App launches without crash on a REAPER installation with 300+ installed icons
- [ ] `list_installed_icons` completes in <1s (filesystem-bound, not main-thread-bound)
- [ ] `get_icon_thumbnails` returns without blocking the UI (sub-second perceived latency)
- [ ] Frontend displays thumbnails correctly (no regression)
- [ ] `cargo test` passes (existing + updated tests)
- [ ] Error in `get_icon_thumbnails` does not crash the frontend
