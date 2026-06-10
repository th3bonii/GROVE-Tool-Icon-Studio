# Design: Layout, Preview, and Performance Fixes

## Technical Approach

Four independent fixes scoped per the proposal: (1) CSS scroll container for installed icons, (2) 1× preview cap with optional 2× zoom, (3) source image caching + async commands + pre-resize optimization in the Rust pipeline, (4) window resize to 800×850 with scroll-free layout. Each fix is independently revertible.

## Architecture Decisions

### Decision 1: Source Image Caching Strategy

**Choice**: `std::sync::Mutex<Option<CachedSource>>` wrapped as a module-level static in `image_processor.rs`.

**Alternatives**: `OnceLock`, `lazy_static`, Tauri managed state.

**Rationale**: `OnceLock` is set-once — can't invalidate on crop/file change. Tauri managed state requires passing through every command signature (invasive). A `Mutex<Option<CachedSource>>` is simple, allows invalidation by setting `None`, and keeps the cache local to the module. `CachedSource` stores (path, crop_hash, center-cropped square). Re-computed on miss. Crop/adjustment changes that don't alter the center-crop region still trigger re-encode but skip the decode+center-crop step.

### Decision 2: Async Tauri Commands

**Choice**: Convert `preview_icon`, `process_icon`, `install_icon_set` to `async fn` in `lib.rs`, with `tokio::task::spawn_blocking` wrapping the CPU-bound image processing calls.

**Alternatives**: Keep sync (blocks IPC thread), use `tokio::spawn` (not for CPU work).

**Rationale**: Tauri v2 natively supports async commands — they run on a separate async runtime thread. CPU-bound image ops (`image::open`, Lanczos3 resize, HSB pixel loops) must use `spawn_blocking` to avoid starving the async runtime. Frontend `api.ts` calls remain `await invoke(...)` — no API surface change.

### Decision 3: Pre-Resize Optimization

**Choice**: In `generate_icon_set` / `generate_icon_set_raw`, center-crop to square once, then for each `REAPER_SCALES` value resize the square to that scale once, and iterate HSB states per pre-resized buffer.

**Current**: 1 decode → 1 center-crop → for each of 3 scales: resize to scale → apply padding → for each of 6 states: apply HSB → copy to strip. That's 3 resizes + 18 HSB applications.

**New**: 1 decode → 1 center-crop → resize to each of 3 scales → for each scale: apply padding once → for each of 6 states: apply HSB → copy to strip. That's 3 resizes, 3 padding operations, 18 HSB applications. Same HSB count but padding reduced from 18→3 and the resizes happen from the center-cropped square (same input size) instead of from the full source each time.

**Rationale**: The main bottleneck is re-reading source on every crop change (Decision 1). The pre-resize restructure is a modest gain but important for the install/generate path where all 3 scales × 6 states run.

### Decision 4: Preview at Actual REAPER Size

**Choice**: `getDisplayScale()` caps at 2× with `Math.min(2, computed)` instead of `Math.min(3, computed)`. At 1× display, show "(actual size)" annotation. At 2×, show "(2× zoom)".

**Alternatives**: Cap at 1× (too small for editing), keep 3× (misleading), add adjustable scale slider (scope creep).

**Rationale**: 30px at 1× is the actual REAPER toolbar size. 2× gives the user enough detail to inspect the icon without overwhelming the layout. The annotation educates the user about actual dimensions. This is in `StatePreview.tsx` — no changed `getStripScale` since strips are already max 500px wide.

### Decision 5: Layout Reorg for Scroll-Free

**Choice**: Increase `.container` max-width to `720px`, window to 800×850. Sections flow top-to-bottom in existing order. Installed icons list gets `max-height: 200px; overflow-y: auto`. The "Generate" button section stays pinned at the bottom of the scroll view.

**Rationale**: The existing vertical layout is correct — only the installed-icons tag list overflows. `max-height: 200px` on `.install-installed-tags` limits that list. The other sections (REAPER path, source icon, crop+preview, HSB, install, generate) all fit within 850px. If window is resized below 850px, the browser handles natural overflow-y on the body.

### Decision 6: Window Config

**Choice**: `tauri.conf.json` → `width: 800, height: 850` with `minWidth: 800, minHeight: 850`.

**Rationale**: 800×600 clips the lower panels (install, generate, results). 800×850 fits all panels at default font sizes. Setting min dimensions prevents the user from shrinking below scroll-free. Default height increased by 250px.

## Data Flow (Pre-resize + Cache)

```
Source read (disk) ──→ decode ──→ center-crop square ──→ cached
                              │
                    resize to 30px ──→ apply padding ──→ HSB × 6 states ──→ encode → base64
                    resize to 45px ──→ apply padding ──→ HSB × 6 states ──→ encode → base64
                    resize to 60px ──→ apply padding ──→ HSB × 6 states ──→ encode → base64
```

Cache invalidated: on new `selectedFile`, crop change that modifies center-crop dimensions.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs` | Modify | Add `CachedSource` struct + `Mutex<Option<CachedSource>>`; restructure `generate_icon_set`/`generate_icon_set_raw` loops for pre-resize |
| `src-tauri/src/lib.rs` | Modify | Convert 3 commands to `async fn` with `spawn_blocking`; add cache-aware `preview_icon` |
| `src-tauri/tauri.conf.json` | Modify | `width: 800, height: 850`, add `minWidth: 800, minHeight: 850` |
| `src/StatePreview.tsx` | Modify | `getDisplayScale` cap at 2×; add size annotation labels |
| `src/App.css` | Modify | `.install-installed-tags` → `max-height: 200px; overflow-y: auto`; `.container` → `max-width: 720px` |
| `src/api.ts` | No change | Interface unchanged — commands remain `invoke(...)` calls |

## Interfaces / Contracts

```rust
// New — module-level cache
struct CachedSource {
    path: String,
    crop_hash: u64,         // hash of CropArea dimensions
    square: RgbaImage,       // center-cropped square, ready for resize
}

// Cache — module-level, no API change
static SOURCE_CACHE: Mutex<Option<CachedSource>> = Mutex::new(None);

// Existing signatures become async — no param changes
#[tauri::command]
async fn preview_icon(...) -> Result<Vec<ProcessingOutput>, String>
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Cache hit/miss logic | Mock source file, verify `generate_icon_set` skips decode on cache hit |
| Unit | Pre-resize output identical | Compare bytes from old pipeline vs new pipeline for same inputs |
| Integration | Async commands still return correct base64 | Call `preview_icon` via `invoke`; verify 3 scale outputs |
| E2E | Preview at 2× renders in DOM | Check `StatePreview` renders `image` with `width <= scale * 2` |
| E2E | Installed icons scroll | Mount `InstallPanel` with 50+ icons; verify container scrolls |
| E2E | Window opens at 800×850 | Tauri window size assertion (manual or integration) |

## Migration / Rollout

No migration required. Each fix is independently revertible:
- CSS scroll: revert single selector in `App.css`
- Preview cap: revert `getDisplayScale` in `StatePreview.tsx`
- Cache + async: revert `lib.rs` + `image_processor.rs` changes
- Window size: revert `tauri.conf.json`

## Open Questions

- [ ] Does the crop_hash need to incorporate the full `CropArea` fields (x, y, width, height) or only width/height (center-crop is deterministic from dimensions)? Using all 4 fields for safety.
- [ ] Should `list_installed_icons` become async too? It does filesystem I/O — could block. Proposal says only `preview_icon`, `process_icon`, `install_icon_set`. Keep scope narrow.
