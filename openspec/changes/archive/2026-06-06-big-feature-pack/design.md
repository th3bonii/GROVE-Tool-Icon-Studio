# Design: Big Feature Pack

## Technical Approach

Four features (A→D) with strict dependency chain. A changes the IPC shape for all 3 commands; B–D are additive. Each is independently revertible. All Rust changes are backward-compatible via `Option` IPC params. Frontend is React hooks + components extending existing patterns.

## Architecture Decisions

| Decision | Option A | Option B | Choice | Rationale |
|----------|----------|----------|--------|-----------|
| HSB IPC shape | Optional `[HsbAdjustment; 3]` per variant | New dedicated IPC command | **Option A** | `IconConfig` already has the fields; serde just works. Backward compat via `None` → defaults |
| Strip preview | Frontend-only render from existing base64 | New IPC command returning strip URL | **Frontend-only** | `preview_icon` already returns full 6-state strip as base64. Zero backend change |
| Delete icon | Single IPC removing all 3 scales | 3 separate IPC calls | **Single IPC** | Atomicity without coupling. Frontend calls once, backend handles scale iteration |
| Batch processing | Frontend sequential loop | New Rust batch command | **Frontend loop** | Avoids Rust complexity for v1. Reuses `process_icon` as-is. Install All calls existing `installIconSet` per file |

## Data Flow

```
A: HSB Sliders
  HsbPanel -> useHsbAdjustments (state) -> useIconPreview (debounced)
    -> previewIcon(selectedFile, crop, padding, isToggle, off_adjustments, on_adjustments)
    -> Rust preview_icon cmd -> ImageProcessor::generate_icon_set() -> base64 -> StatePreview

B: Strip Preview
  StatePreview(viewMode='strips') -> renders <img> with full base64 strip
    No IPC change — base64 already contains the full 6-state strip

C: Icon Manager
  InstallPanel click -> getIconStrip(iconName) -> Rust get_icon_strip -> reads file -> base64
  InstallPanel delete -> deleteIcon(iconName) -> Rust delete_icon -> unlink 3 scale dirs
  InstallPanel export -> @tauri-apps/plugin-dialog save() -> fs copy

D: Batch Processing
  BatchPanel -> useBatchProcessing -> loop: processIcon(file, ..., hsbSettings)
    -> per-file: ProcessingOutput[] stored -> Install All -> loop: installIconSet per file
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/lib.rs` | Modify | Add `off_adjustments`/`on_adjustments` to 3 IPC cmds; add `delete_icon`, `get_icon_strip` |
| `src-tauri/src/installer.rs` | Modify | Add `delete_icon()` (unlink 3 scales), `get_icon_strip()` (read + b64 encode) |
| `src/api.ts` | Modify | Add HSB params to `processIcon`, `previewIcon`, `installIconSet`; add `deleteIcon`, `getIconStrip` |
| `src/hooks/useHsbAdjustments.ts` | **New** | State for 6 HsbAdjustment tuples + defaults reset |
| `src/hooks/useBatchProcessing.ts` | **New** | `BatchFile[]` state, sequential process loop, progress, Install All |
| `src/hooks/useIconPreview.ts` | Modify | Accept `off_adjustments`/`on_adjustments`, pass to `previewIcon` |
| `src/hooks/useIconProcessing.ts` | Modify | Accept HSB params, pass to `processIcon` |
| `src/hooks/useIconInstall.ts` | Modify | Add `handleDelete`, `handleExport`, `handleGetStrip` methods |
| `src/App.tsx` | Modify | Wire HSB state, strip view toggle, batch mode toggle, batch file list |
| `src/StatePreview.tsx` | Modify | Add `viewMode` prop; strip mode renders full base64 as `<img>` |
| `src/InstallPanel.tsx` | Modify | Clickable icon tags, delete button (confirm dialog), export button |
| `src/BatchPanel.tsx` | **New** | File list with status, Process All, Install All, progress indicator |

## Interfaces / Contracts

```rust
// New IPC commands
#[tauri::command]
fn delete_icon(reaper_resource_path: String, icon_name: String) -> Result<(), String>

#[tauri::command]
fn get_icon_strip(reaper_resource_path: String, icon_name: String) -> Result<String, String>
```

```typescript
// New TypeScript bindings
export async function deleteIcon(reaperResourcePath: string, iconName: string): Promise<void>
export async function getIconStrip(reaperResourcePath: string, iconName: string): Promise<string>

// Batch processing data structures
interface BatchFile {
  path: string;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: ProcessingOutput[];
  error?: string;
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Rust unit | `delete_icon` edge cases (all 3 scales, partial, missing) | `cargo test`, temp dir fixtures (existing pattern) |
| Rust unit | `get_icon_strip` (file exists, missing, invalid PNG) | `cargo test`, temp dir fixtures |
| Rust unit | IPC backward compat — `None` HSB params produce same output | Existing tests pass unchanged (no new params = all-zero adjustments) |
| Rust integration | New IPC commands via Tauri test harness | Manual smoke test (no Tauri harness in project) |
| Rust compilation | Full suite | `cargo test` — all existing tests MUST pass |
| Frontend manual | HSB sliders affect preview | Visual inspection with debounce |
| Frontend manual | Strip view toggle renders correctly | Visual inspection |
| Frontend manual | Delete + export flows | Manual click-through |

## Migration / Rollout

No migration required. Feature A changes are backward-compatible — existing frontend sends no HSB params, Rust defaults to all-zero. Features B–D are purely additive. Rollback: revert `lib.rs` params → frontend falls back to all-zero. Batch mode is a frontend toggle only (no Rust changes).

## Open Questions

- [ ] Should `get_icon_strip` read from 100% scale only, or try 150/200 fallback? Spec says 100% only — confirm.
- [ ] Export: save raw PNG strip (file format as-is) or re-encode as base64? Spec implies raw bytes from disk → write directly.
- [ ] Delete partial failure: if 2 of 3 scales delete but 3rd fails, report error with what-was-deleted info? Spec says `Ok(())` on full success, error otherwise.
