# Design: Fix Startup Crash and Slowness

## Technical Approach

Convert two synchronous Tauri commands (`list_installed_icons`, `get_icon_thumbnails`) to async using the established `tokio::task::spawn_blocking` pattern from `process_icon`/`preview_icon`. The async boundary stays at the Tauri command level in `lib.rs`; the `installer.rs` helpers remain unchanged. On the frontend, switch `getIconThumbnails` from raw `invoke` to `safeInvoke` + Zod schema, and add `.catch()` to the thumbnail `useEffect` in `InstallSection.tsx`.

## Architecture Decisions

### Decision: Async boundary at Tauri command, not helper

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Convert `installer.rs` helpers to async | Touches more code, changes internal API | **Rejected** — unnecessary scope |
| Wrap helpers in `spawn_blocking` in `lib.rs` | Adds ~10 LoC per command, follows existing pattern (`process_icon` line 51, `preview_icon` line 120) | **Chosen** — minimal delta, proven pattern |
| Use `async` on the helper directly (no spawn_blocking) | File I/O still blocks the async threadpool | **Rejected** — spawn_blocking is the correct Tokio pattern for blocking I/O |

### Decision: Error detection for `get_icon_thumbnails`

The `installer::get_icon_thumbnails` helper silently skips unreadable files (`if let Ok(bytes)`). The spec requires errors to surface. The Tauri command wrapper compares input names vs the returned map keys — missing names produce `Err`.

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Change helper to return `Result` | Breaks scope (installer.rs stays sync) | **Rejected** |
| Compare input vs output in `lib.rs` wrapper | ~5 LoC, zero changes to installer.rs | **Chosen** — scope-safe, correctness guarantee |

### Decision: `.catch()` on useEffect promise

The existing effect uses `.then()`-style promise (`const load = async () => {...}; load();`). Adding `.catch()` is the minimal change. Converting to `try/catch` inside `load()` would require restructuring.

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `.catch()` on the promise | Keeps existing structure intact | **Chosen** — 1-line addition |
| try/catch inside `load()` | Requires wrapping entire body in try/catch | **Rejected** — more invasive |

## Data Flow

```
Frontend                          Tauri Backend
─────────                         ─────────────
InstallSection                    lib.rs
  useEffect                          │
    │                                ├── list_installed_icons (async)
    ├── listInstalledIcons() ────────┤   └── spawn_blocking → installer::list_installed_icons()
    │                                │       └── read_dir × 6 (scale dirs)
    │                                │
    │                                ├── get_icon_thumbnails (async)
    └── getIconThumbnails() ────────┤   └── spawn_blocking → installer::get_icon_thumbnails()
       safeInvoke + zod              │       └── read × N (one per icon)
       └── .catch() → set error      │       error: missing names → Err
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/lib.rs` | Modify | Lines 199-226: convert both commands to `async fn` with `spawn_blocking` and Result return type for `get_icon_thumbnails` |
| `src-tauri/src/installer.rs` | Unchanged | Helpers stay sync — `get_icon_thumbnails` silent skip is handled by command wrapper |
| `src/api.ts` | Modify | Lines 216-227: replace raw `invoke` with `safeInvoke` + `z.record(z.string(), z.string())` |
| `src/sections/InstallSection.tsx` | Modify | Line 108: add `.catch()` to the `load()` promise |

## Interfaces / Contracts

```typescript
// NEW — getIconThumbnails return type
type ThumbnailMap = Record<string, string>; // icon_name → base64 data URI
```

The Rust side changes from `HashMap<String, String>` to `Result<HashMap<String, String>, String>`. Tauri's IPC layer automatically serializes the Result — `Ok` delivers the map, `Err` throws a JS exception. `safeInvoke` receives the unwrapped `Ok` value and validates it against `z.record(z.string(), z.string())`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (lib.rs) | `list_installed_icons` returns icons from all scales, empty dir | Existing tests (lines 649-692) become `#[tokio::test]` + `.await` |
| Unit (lib.rs) | `get_icon_thumbnails` returns `Err` for missing icons | New `#[tokio::test]` calling the async command |
| Unit (installer.rs) | Helper-level list/thumbnail tests | Unchanged — still sync `#[test]` |
| Integration | Frontend handles error gracefully | Manual: break a PNG on disk, verify no unhandled rejection |

## Migration / Rollout

No migration required. The IPC command name strings stay the same (`list_installed_icons`, `get_icon_thumbnails`). Tauri dispatches correctly regardless of sync/async — the `#[tauri::command]` attribute handles the runtime. Rollback: revert the two command signatures, revert `api.ts`, revert `InstallSection.tsx`.

## Open Questions

None — all decisions are scoped and the patterns are established in the codebase.
