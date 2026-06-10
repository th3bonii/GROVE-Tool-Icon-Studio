# Proposal: Layout, Preview, and Performance Fixes

## Intent

Fix 4 usability issues: installed icons list overflows (hundreds of tags beyond container), preview renders at 3× actual REAPER toolbar size, app freezes on crop change (sync IPC + no cache), and 800×600 window clips UI panels.

## Scope

### In Scope
- CSS scroll container for installed icons list (`max-height` + `overflow-y`)
- Preview at actual REAPER toolbar size (1×, max 2× with size annotation)
- Source image caching in Rust (`OnceLock`) — avoids re-reading on every adjustment
- Async Tauri commands for `preview_icon` and related image IPC
- Pre-resize source to each target scale once, reuse across states/variants
- Window resize to 800×850 + element repositioning for scroll-free layout

### Out of Scope
- Backend architecture changes beyond caching + async
- New UI features, components, or theme support
- Batch processing improvements

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `visual-editor`: Preview MUST display icons at actual pixel dimensions (1:1 scale for target size) with optional 2× zoom and size annotation, replacing the current 3× cap
- `app-shell`: Window minimum size MUST be at least 800×850 to fit all panels without vertical scrolling

## Approach

1. **CSS scroll**: Add `max-height: 200px; overflow-y: auto` to installed-icons container in `App.css`
2. **Preview cap**: `StatePreview` caps display at 1× actual pixel size; adds "(actual size)" label at 1×; max 2× if user zooms
3. **Window**: `tauri.conf.json` → `width: 800, height: 850`; adjust panel layout in CSS
4. **Source cache**: Wrap source image in `OnceLock` keyed by (path, crop_hash) in `image_processor.rs`
5. **Async commands**: Convert sync `fn` to `async fn` in `lib.rs` for `preview_icon`, `process_icon`, `install_icon_set`
6. **Pre-resize**: Resize source to each `REAPER_SCALES` value once before iterating states/variants

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.css` | Modified | Installed-icons scroll, preview sizing, panel layout |
| `src/StatePreview.tsx` | Modified | Cap display scale at actual size |
| `src-tauri/tauri.conf.json` | Modified | window width=800, height=850 |
| `src-tauri/src/lib.rs` | Modified | Convert preview/process commands to async |
| `src-tauri/src/image_processor.rs` | Modified | OnceLock cache + pre-resize per scale |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Async IPC breaks existing callers | Low | Keep sync wrapper; test all 3 commands |
| Cache invalidation wrong on new source | Med | Key by (path, crop_hash); clear on selection change |
| Preview at 1× too small for usability | Med | Allow 2× max with "(actual size)" annotation at 1× |

## Rollback Plan

Each fix is independently revertible. Worst case: `git revert <commit>` per area, or restore `tauri.conf.json` window size.

## Dependencies

- None beyond existing `image` crate (0.24) and `tokio` (Tauri v2 default)

## Success Criteria

- [ ] `max-height: 200px` applied — 300+ icons scroll within container, "Generate" button always visible
- [ ] Preview renders at 1:1 pixel ratio (30px icon → 30px preview) with 2× optional
- [ ] Crop adjustment triggers single source read (confirmed via `log::debug!`)
- [ ] Commands are `async fn` — main thread not blocked on heavy processing
- [ ] Window opens at 800×850, all panels visible without vertical scroll
