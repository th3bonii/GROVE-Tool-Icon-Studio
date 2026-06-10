# Proposal: Big Feature Pack

## Intent

Ship 4 user-facing features that turn the tool from a single-icon processor into a full icon studio: adjustable HSB per state, full strip preview, installed icon management, and batch processing.

## Scope

### In Scope
- **A**: 6 sets of HSB sliders (Hue -180/+180, Sat -100/+100pp, Bri -100/+100pp) grouped by OFF/ON × Normal/Hover/Active with debounced real-time preview
- **B**: Strip view toggle in StatePreview showing the full 6-frame strip with dimension labels and file path pattern
- **C**: delete_icon + get_icon_strip IPC commands; click installed icon to preview strip; delete with confirmation; export via save dialog
- **D**: Multi-file selection when in batch mode; file list with status checkboxes; Process All (sequential); Install All with auto-naming; progress bar

### Out of Scope
- HSB preset save/load (deferred)
- Rename installed icon (complex copy+delete cycle)
- Parallel batch processing (sequential v1 only)
- Drag-drop file reorder in batch list

## Capabilities

### New Capabilities
- `icon-manager`: delete_icon + get_icon_strip IPC commands; frontend management (click, preview, delete, export)
- `batch-processing`: multi-file selection, Process All, Install All, progress bar

### Modified Capabilities
- `icon-processing-pipeline`: process_icon, preview_icon, install_icon_set IPC commands gain optional `off_adjustments: [HsbAdjustment; 3]` and `on_adjustments: [HsbAdjustment; 3]` params
- `visual-editor`: HSB slider UI (Feature A), strip view toggle (Feature B), clickable installed icons (Feature C), batch UI (Feature D)

## Approach

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HSB IPC shape | Pass `off_adjustments`/`on_adjustments` as optional JSON arrays (serde) | Straightforward — IconConfig already has the fields, just expose them through IPC |
| Strip preview | Extend `preview_icon` output | Already returns full strip as base64; no new command needed |
| Delete icon | Single `delete_icon` command removes all 3 scales | Simple, keeps interface clean |
| Batch processing | Frontend sequential loop reusing `process_icon` | Avoids Rust-side iteration complexity for v1 |

**Dependency order**: A → B → C → D. Feature A changes IPC shape (affects all 3 commands), so it ships first. B is purely frontend. C adds new IPC + frontend. D uses all prior features.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/src/lib.rs` | Modified | Add HSB params to 3 IPC commands; add delete_icon, get_icon_strip commands |
| `src-tauri/src/installer.rs` | New + Modified | Add `delete_icon()`, `get_icon_strip()` functions |
| `src/api.ts` | Modified | Add HSB params to API wrappers; add new IPC bindings |
| `src/hooks/useIconPreview.ts` | Modified | Pass HSB adjustments to preview_icon |
| `src/hooks/useIconProcessing.ts` | Modified | Pass HSB adjustments to process_icon |
| `src/hooks/useIconInstall.ts` | Modified | Add delete/preview installed handlers |
| `src/hooks/useIconBatch.ts` | **New** | Batch processing state + sequential loop |
| `src/App.tsx` | Modified | Batch mode, HSB state, strip view toggle |
| `src/StatePreview.tsx` | Modified + Rename? | Add strip view; HSB sliders per state |
| `src/InstallPanel.tsx` | Modified | Clickable icons, delete, export |
| `src/BatchPanel.tsx` | **New** | File list, Process All, Install All |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| IPC shape change breaks existing frontend | Low | Keep old params optional with backward-compat defaults |
| HSB slider performance on 60px 6-state | Low | Debounce via existing useDebounce hook (300ms) |
| Delete permanent data | Med | Delete with confirmation dialog + trash as secondary option |

## Rollback Plan

Per feature: revert IPC param additions → frontend falls back to defaults. Delete on per-file basis — no coupling between features. Batch mode is purely additive (no code changes to existing single-file path).

## Dependencies

- None external. All changes within existing crate (image, serde, base64 already vendored).

## Success Criteria

- [ ] All 6 HSB sliders adjust preview in real-time (debounced)
- [ ] Strip view renders full frame strip with labels
- [ ] Installed icon shows preview on click, deletes with confirmation
- [ ] Batch process 3+ files sequentially, all install with auto-names
- [ ] All existing `cargo test` tests pass unchanged
