# Tasks: Big Feature Pack

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~670 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (HSB) → PR 2 (Strip + Manager) → PR 3 (Batch) |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Feature A (HSB) | PR 1 | Rust IPC + tests + HsbPanel + hooks + App wiring. Largest slice (~250 lines) |
| 2 | Features B + C (Strip + Manager) | PR 2 | StatePreview strip toggle + InstallPanel click/delete/export + new IPC. Base = main or feature branch |
| 3 | Feature D (Batch) | PR 3 | BatchPanel + useBatchProcessing + App wiring. Purely frontend, depends on prior UI layout |

## Phase 1: Rust Backend Foundation

- [ ] 1.1 Add `off_adjustments`/`on_adjustments: Option<[HsbAdjustment; 3]>` to `process_icon`, `preview_icon`, `install_icon_set` in `src-tauri/src/lib.rs` — thread into `IconConfig`
- [ ] 1.2 Update all 8 existing Rust test calls in lib.rs to pass `None` for the 2 new HSB params
- [ ] 1.3 Add `delete_icon()` (unlink 3 scale dirs) + `get_icon_strip()` (read + b64) to `src-tauri/src/installer.rs`
- [ ] 1.4 Add `delete_icon` + `get_icon_strip` Tauri commands in `src-tauri/src/lib.rs`; register in `generate_handler!`
- [ ] 1.5 Write Rust tests for `delete_icon` (all 3 scales, partial, missing) + `get_icon_strip` (exists, missing) — temp dir fixtures
- [ ] 1.6 Verify `cargo test` passes: all existing + new tests

## Phase 2: Frontend Components & Hooks

- [ ] 2.1 Create `src/HsbPanel.tsx` — 3 sliders (hue_shift, sat_delta, bri_delta) for one state with labels and reset
- [ ] 2.2 Create `src/hooks/useHsbAdjustments.ts` — manages 6 `HsbAdjustment` tuples (OFF/ON × Normal/Hover/Active) + defaults
- [ ] 2.3 Add HSB params to `processIcon`, `previewIcon`, `installIconSet` in `src/api.ts` — backward-compat via `?? null`
- [ ] 2.4 Update `src/hooks/useIconPreview.ts` — accept `off_adjustments`/`on_adjustments`, pass to `previewIcon`
- [ ] 2.5 Update `src/hooks/useIconProcessing.ts` — accept HSB params, pass to `processIcon` in `handleGenerate`
- [ ] 2.6 Update `src/hooks/useIconInstall.ts` — accept HSB params; add `handleDelete`, `handleExport`, `handleGetStrip`
- [x] 2.7 Create `src/hooks/useBatchProcessing.ts` — `BatchFile[]` state, sequential `previewIcon` loop, progress tracking ✅ IMPLEMENTED

## Phase 3: Integration & UI Wiring

- [ ] 3.1 Add `viewMode` ('states' | 'strips') state + toggle button in `src/App.tsx`; render 6 `HsbPanel` instances with conditional ON section based on `isToggle`
- [ ] 3.2 Update `src/StatePreview.tsx` — add `viewMode` prop; strip mode renders full base64 `<img>` with scale/dir labels
- [ ] 3.3 Update `src/InstallPanel.tsx` — clickable icon names → strip preview; delete button (confirm dialog); export button (save dialog)
- [x] 3.4 Create `src/BatchPanel.tsx` — file list with status badges, Process All, Install All, progress indicator ✅ IMPLEMENTED
- [x] 3.5 Update `src/App.tsx` — add Batch Mode toggle, wire `BatchPanel` + `useBatchProcessing` ✅ IMPLEMENTED
- [x] 3.6 Add CSS classes for HsbPanel sliders, strip view, batch panel, delete/export buttons ✅ (HSB + strip + delete/export in PR 1/2; batch panel in PR 3)

## Phase 4: Verify

- [ ] 4.1 Run `cargo test` — all Rust tests pass, including backward-compat (None HSB = defaults)
- [ ] 4.2 Manual: adjust HSB sliders → debounced preview reflects changes
- [ ] 4.3 Manual: toggle strip view → full strip renders with labels
- [ ] 4.4 Manual: click installed icon → strip preview; delete with confirm → icon removed; export → file saved
- [ ] 4.5 Manual: batch process 3 files → sequential, status updates, install all installs successful only
