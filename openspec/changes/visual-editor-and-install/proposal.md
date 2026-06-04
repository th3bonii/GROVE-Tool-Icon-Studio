# Proposal: visual-editor-and-install

## Intent

Replace the current file-select-and-generate flow with an interactive visual editor: crop source images on a canvas, see real-time 3-state preview, choose size, name the output, and optionally install directly to REAPER. Eliminates the blind generate–check–iterate cycle.

## Scope

### In Scope
- Canvas cropper with fixed 1:1 aspect ratio drag selection
- Real-time 3-state preview panel (Normal / Hover / Click)
- Auto-install checkbox + icon naming field
- Size selector: standard (30px) vs double-width (38px)
- Rust commands: `install_icon`, `list_installed_icons`
- Modified `process_icon` to accept crop coords + target size
- Preview IPC path: Rust generates preview as base64 for frontend rendering

### Out of Scope
- Undo/redo for crop adjustments
- Custom brightness/color tweaks per state
- Batch processing multiple icons
- REAPER API integration (beyond file copy)

## Capabilities

### New Capabilities
- `visual-editor`: Canvas cropper with 1:1 drag selection and real-time 3-state icon preview panel
- `reaper-install-flow`: Install generated icons to REAPER's `Data/toolbar_icons/` folder and list existing icons

### Modified Capabilities
- `icon-processing-pipeline`: MUST accept crop coordinates `(x, y, w, h)` and target size (standard vs double-width); existing 3-state generation core preserved

## Approach

**Frontend**: Add `<CanvasCropper>` (HTML Canvas + mouse drag) and `<PreviewPanel>` (renders 3 states side-by-side via base64 IPC). Add `<InstallOptions>` for naming + auto-install toggle. **Backend**: Add `install_icon(src, name)` → copies to `{reaper}/Data/toolbar_icons/{name}.png` and `list_installed_icons()` → lists files in that dir. Extend `process_icon` with optional `crop: {x, y, w, h}` and `size: "standard" | "double"` params. Preview render reuses the same pipeline but returns base64-encoded PNG instead of writing to disk.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | Modified | Replace file-select layout with visual editor |
| `src/components/` | New | CanvasCropper, PreviewPanel, InstallOptions |
| `src/api.ts` | Modified | New IPC wrappers + new process_icon params |
| `src-tauri/src/lib.rs` | Modified | Register new commands, extend process_icon |
| `src-tauri/src/image_processor.rs` | Modified | Crop + size config + base64 preview output |
| `src-tauri/src/installer.rs` | New | install_icon + list_installed_icons commands |
| `src/App.css` | Modified | Styles for cropper, preview, install controls |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Canvas rendering differs from final Rust output | Med | Preview runs same Rust pipeline (base64 path) |
| REAPER toolbar_icons path diverges from resource path | Low | Append `Data/toolbar_icons` to detected path — well-known REAPER convention |
| Crop UX feels laggy on large source images | Low | Downscale displayed image for canvas; crop on original for final output |

## Rollback Plan

Revert `process_icon` to original signature, remove new commands, delete `src/components/*`, delete `src-tauri/src/installer.rs`. Git diff isolates all changes cleanly.

## Dependencies

- Rust `base64` crate (or manual encode) for preview IPC transfer
- `@tauri-apps/api` already installed for IPC

## Success Criteria

- [ ] User loads image, drags crop rectangle, sees 3-state preview update in real-time
- [ ] Generated icon uses correct crop coordinates (not full source)
- [ ] Standard mode: per-state 30×30 → output 90×30; double-width: 38×38 → output 114×38
- [ ] Install toggle writes file to `{reaper}/Data/toolbar_icons/{name}.png`
- [ ] `list_installed_icons` returns files in toolbar_icons folder
