# Design: Architectural Review Fixes

## Technical Approach

Five independent refactorings fixing 5 defects from a systematic architecture review. Each is a small, revertible, behavior-preserving change. No new IPC commands, no schema changes, no migrations.

## Architecture Decisions

### 1. Remove Double Processing (App.tsx)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Thread results through | Complex, breaks hook separation | ❌ |
| Just remove auto-install | InstallPanel already provides `onInstall` | ✅ |

**Rationale**: `handleGenerate` calls `processIcon` (writes to `Data/toolbar_icons/`) then `handleAutoInstall` → `installIconSet` (reprocesses source to REAPER dirs). The InstallPanel's manual install covers the same flow. Removing lines 102–104 and the `handleAutoInstall` dep eliminates 7–15ms of duplicate image processing.

### 2. Extract IconConfig Builder (lib.rs)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `IconConfig::from_options()` in `image_processor.rs` | More idiomatic, couples IPC to domain type | ❌ |
| Free `fn build_icon_config()` in `lib.rs` | Keeps IPC module self-contained | ✅ |

**Rationale**: All 3 commands (`process_icon`, `preview_icon`, `install_icon_set`) repeat ~7 lines of `IconConfig` construction. A free function at the IPC boundary avoids leaking `Option`-unwrapping into the domain layer. Signature: `fn build_icon_config(padding: Option<u8>, is_toggle: Option<bool>, off: Option<[HsbAdjustment; 3]>, on: Option<[HsbAdjustment; 3]>) -> IconConfig`.

### 3. Remove SOURCE_CACHE (image_processor.rs)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Keep as-is | Single-entry, never hits in batch | ❌ |
| Replace with HashMap | Adds complexity for marginal gain | ❌ |
| Delete entirely | Files are 32×32px, I/O ~0.1ms | ✅ |

**Rationale**: `SOURCE_CACHE` is a `Mutex<Option<CachedSource>>` — single-entry, invalidated on path or crop change. In batch mode every file differs, so hit rate is 0%. Even in single-file mode, reading a 4KB PNG is negligible. Removing it eliminates `Mutex`, `hash_crop()`, `CachedSource` struct, and ~60 lines. Inline the disk read in `load_source_cached` → rename to `load_source`.

### 4. Fix Stale Closure (useBatchProcessing.ts)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Just capture `total` | Partial fix, `files[i]` still stale | ❌ |
| `useRef` + local snapshot | Eliminates `[files]` dep, avoids re-creating callback | ✅ |

**Rationale**: `processAll` has `[files]` in `useCallback` deps, recreating on every status change. Use a `useRef` synced on every render. Inside `processAll`, capture `const currentFiles = filesRef.current` and `const total = currentFiles.length` for the loop. No deps needed — callback is stable.

### 5. Corner Radius Constant

| Option | Tradeoff | Decision |
|--------|----------|----------|
| IPC command `get_corner_radius_factor` | Single source of truth, but async overhead | ❌ |
| Build-time injection | Too complex for a constant | ❌ |
| Static const in Rust + TS, verified by tests | Simple, trivially verifiable | ✅ |

**Rationale**: `CORNER_RADIUS_FACTOR = 0.15` is a design constant, not runtime config. Define once in each language. Rust test: `assert_eq!(CORNER_RADIUS_FACTOR, 0.15)`. TS test: same. Extract `fn icon_corner_radius(scale: u32, padding: u8) -> u32` in Rust and `function getCornerRadius(scale: number, padding: number): number` in `StatePreview.tsx`.

## Data Flow Changes

```
BEFORE handleGenerate (App.tsx):
  processAndGenerate() ──→ processIcon (writes to Data/toolbar_icons/)
       │
       └── handleAutoInstall() ──→ installIconSet (reprocesses source → REAPER dirs)

AFTER handleGenerate (App.tsx):
  processAndGenerate() ──→ processIcon (writes to Data/toolbar_icons/)
  (InstallPanel handles install separately via onInstall)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/App.tsx` | Modify | Remove lines 102-104 (auto-install), remove `handleAutoInstall` from deps |
| `src/hooks/useBatchProcessing.ts` | Modify | Add `useRef` for files, capture snapshot at `processAll` call time |
| `src/StatePreview.tsx` | Modify | Extract `getCornerRadius()`, import `CORNER_RADIUS_FACTOR` |
| `src/api.ts` | Modify | Export `CORNER_RADIUS_FACTOR` constant |
| `src-tauri/src/lib.rs` | Modify | Extract `fn build_icon_config()`, call from 3 commands |
| `src-tauri/src/image_processor.rs` | Modify | Remove `SOURCE_CACHE` + `hash_crop` + `CachedSource`. Add `CORNER_RADIUS_FACTOR` const + `fn icon_corner_radius()` |

## Interfaces / Contracts

No new Tauri commands. No schema changes. New exports:

```rust
// image_processor.rs
pub const CORNER_RADIUS_FACTOR: f64 = 0.15;
pub fn icon_corner_radius(scale: u32, padding: u8) -> u32;
```

```typescript
// api.ts
export const CORNER_RADIUS_FACTOR = 0.15;
```

```rust
// lib.rs — no pub, module-private helper
fn build_icon_config(...) -> IconConfig;
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Rust unit | Config builder | 1 test verifying correct field mapping |
| Rust unit | Corner radius const | 1 test verifying value matches |
| Rust unit | Cache removal | Remove cache-specific tests, keep `load_source` integration test reusing `load_source_cached` logic |
| TS unit | useBatchProcessing | Update to verify ref-based approach produces same results (existing tests pass) |
| TS unit | StatePreview | Verify `getCornerRadius()` matches Rust output for 30/45/60 scales |
| Integration | App | Existing App tests still pass — verify generate doesn't call install_icon_set |

**Tests to remove**: 6 cache tests in `image_processor.rs` (`cached_source_struct_has_required_fields`, `source_cache_static_exists_as_mutex_option`, `hash_crop_produces_different_hash`, `load_source_cached_returns_same_as_direct`, `source_cache_hit_avoids_disk_read`, `load_source_cached_cache_invalidates_on_path_change`, `load_source_cached_no_crop_uses_full_image`, `generate_icon_set_uses_cache_and_produces_correct_output` — 8 total).

**Tests to add**: 2 Rust + 2 TS for corner radius consistency.

## Migration / Rollout

No migration required. Each fix is independently revertible via `git revert`. Order doesn't matter — no interdependencies.

## Revert Strategy

| Fix | `git revert` scope | Risk |
|-----|-------------------|------|
| Double processing | `src/App.tsx` only | Low |
| Config builder | `src-tauri/src/lib.rs` only | Low |
| Cache removal | `src-tauri/src/image_processor.rs` + test file | Low (tests removed must be restored) |
| Stale closure | `src/hooks/useBatchProcessing.ts` only | Low |
| Corner radius | `src/StatePreview.tsx` + `src/api.ts` + `src-tauri/src/image_processor.rs` | Low |

## Open Questions

- None — all decisions resolved above.
