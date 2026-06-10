# Tasks: REAPER Standard Compliance

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,050–1,270 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: T1-T2-T3 → PR 2: T4-T5 → PR 3: T6-T7 → PR 4: T8-T9-T10 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (fast iteration, each PR merges independently) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Rust core: HSB + padding + multi-scale | PR 1 | base=main; ~350 lines; T1-T2-T3 |
| 2 | Rust toggle + integration tests | PR 2 | base=main; ~250 lines; T4-T5 |
| 3 | API types + IPC bridge | PR 3 | base=main; ~260 lines; T6-T7 |
| 4 | Frontend UI: preview + controls + install | PR 4 | base=main; ~320 lines; T8-T9-T10 |

## Dependency Graph

```
T1 (HSB math + types) ──→ T2 (padding) ──→ T3 (multi-scale) ──→ T4 (toggle)
                                                                     │
                                                                     └──→ T5 (Rust integration tests)
T6 (API types) ──→ T7 (IPC bridge) ──→ T8 (frontend: 6-state preview)
                                      └──→ T9 (frontend: slider + toggle controls)
                                      └──→ T10 (frontend: multi-scale install panel)
```

---

## Phase 1 — Rust Foundation (HSB + Padding + Multi-Scale)

### [x] T1: HSB Math + New Types

- **Description**: Add `HsbAdjustment` struct, `IconConfig` with ON/OFF adjustment arrays, `rgb_to_hsb`/`hsb_to_rgb` pure functions, and `apply_hsb()` that converts each pixel to HSB, applies deltas, and converts back preserving alpha.
- **Files**: `src-tauri/src/image_processor.rs`
- **Dependencies**: None
- **Test strategy** (TDD — write test first):
  - ✅ `rgb_to_hsb` / `hsb_to_rgb` roundtrip: known RGBA values → HSB → back → identity
  - ✅ `apply_hsb` with hue_shift=0, sat_delta=0, bri_delta=0 produces identity
  - ✅ `apply_hsb` preserves alpha for all pixels
  - ✅ `apply_hsb` with non-zero bri_delta shifts brightness correctly
- **Acceptance**: ✅ `cargo test` passes with all HSB tests (54/54); alpha unchanged across all operations

### [x] T2: Configurable Padding

- **Description**: Add `apply_padding()` that scales icon to `(canvas_size - 2×padding)` and pastes centered on transparent `canvas_size×canvas_size` canvas. Support 0–4px range, clamp at 0.
- **Files**: `src-tauri/src/image_processor.rs`
- **Dependencies**: T1
- **Test strategy** (TDD):
  - ✅ 30px canvas + 2px padding → 26×26 centered icon
  - ✅ padding=0 → full 30×30 canvas
  - ✅ padding=4 on 30px → 22×22 centered
  - ✅ padding≥15 (clamped) → 0-size safety
- **Acceptance**: ✅ `cargo test` passes padding tests; dimensions and centering verified

### [x] T3: Multi-Scale Generation

- **Description**: Add `generate_icon_set()` returning `Vec<ProcessingOutput>` that generates 100% (30px), 150% (45px), 200% (60px) per state. Each scale runs the full pipeline: crop → center-crop square → scale to `(size-2p)` → paste centered → HSB loop for 6 states → assemble strip → rounded corners → encode.
- **Files**: `src-tauri/src/image_processor.rs`
- **Dependencies**: T1, T2
- **Test strategy** (TDD):
  - ✅ `generate_icon_set` produces 3 outputs at 30/45/60
  - ✅ Each output has 6-state dimensions (width = size × 6, height = size)
  - ✅ Preview mode returns base64 for each scale
- **Acceptance**: ✅ `cargo test` passes multi-scale tests; all 3 scales generated

---

## Phase 2 — Toggle + Integration Tests

### [x] T4: Toggle ON/OFF Generation

- **Description**: Add toggle logic to `generate_icon_set()`. When `is_toggle=true`, run pipeline twice per scale (OFF adjustments → `{name}.png`, ON adjustments → `{name}_on.png`). Each file is 6-state. When `is_toggle=false`, only OFF variant produced.
- **Files**: `src-tauri/src/image_processor.rs`
- **Dependencies**: T3
- **Test strategy** (TDD):
  - ✅ Toggle mode produces twice as many outputs
  - ✅ Non-toggle produces only OFF variants
  - ✅ ON files use `_on.png` suffix
  - ✅ Each variant remains 6-state
- **Acceptance**: ✅ `cargo test` passes toggle tests (63/63); correct file count per mode

### [x] T5: Backend Integration Tests + Legacy Cleanup

- **Description**: Write integration tests for the full image_processor pipeline end-to-end. Verify state ordering matches REAPER convention (OFF Normal, OFF Hover, OFF Active, ON Normal, ON Hover, ON Active). Mark `generate_three_state` as deprecated/delegate, update existing tests that reference the old function signature.
- **Files**: `src-tauri/src/image_processor.rs`, `src-tauri/src/lib.rs`
- **Dependencies**: T4
- **Test strategy**:
  - ✅ Full pipeline: crop + padding + multi-scale + toggle
  - ✅ 6-state ordering verification (pixel-level test)
  - ✅ Backward compatibility — all existing 54 tests + 9 new = 63 passing
- **Acceptance**: ✅ `cargo test` passes all 63 tests in workspace

---

## Phase 3 — Frontend Foundation (Types + IPC)

### [x] T6: TypeScript API Types

- **Description**: Add `HsbAdjustment` interface. Update `ProcessingOutput` if needed. Add `IconConfig` interface with `padding`, `is_toggle` fields and adjustment arrays. Add `installIconSet()` function signature.
- **Files**: `src/api.ts`
- **Dependencies**: None (parallel to T1)
- **Test strategy**: TypeScript compilation passes (`tsc --noEmit` or `vitest typecheck`)
- **Acceptance**: `npx tsc --noEmit` succeeds; new types exported and importable

### [x] T7: IPC Bridge Update

- **Description**: Update `process_icon` and `preview_icon` Tauri commands to accept `padding: Option<u8>`, `is_toggle: Option<bool>`, and `scales: Option<Vec<u32>>`. Add `install_icon_set` command that writes to 3 scale directories. Update `installer.rs` with `install_icon_set()` + multi-scale `list_installed_icons()`.
- **Files**: `src-tauri/src/lib.rs`, `src-tauri/src/installer.rs`, `src/api.ts`
- **Dependencies**: T6, T4 (needs toggle backend)
- **Test strategy** (TDD):
  - IPC `process_icon` with padding + toggle produces correct outputs
  - IPC `preview_icon` returns all 3 scales as base64
  - `install_icon_set` creates 3 directories with correct files
  - `list_installed_icons` scans all 3 scale dirs
  - `installer::install_icon_set` copies files to toolbar_icons/, toolbar_icons/150/, toolbar_icons/200/
- **Acceptance**: `cargo test` passes; `api.ts` exports match Rust IPC signatures; all 3 scale dirs created

---

## Phase 4 — Frontend UI

### [x] T8: 6-State Preview Component

- **Description**: Rewrite `StatePreview` to display 6 states in 2 rows (OFF row: Normal, Hover, Active; ON row: Normal, Hover, Active). Update state labels. Receive preview data for each scale. Show dimensions per scale.
- **Files**: `src/StatePreview.tsx`, `src/App.tsx`
- **Dependencies**: T7 (new IPC shape)
- **Test strategy**: `vitest` render test verifies 6 state labels exist; OFF/ON row labels visible
- **Acceptance**: 6-state preview renders with correct OFF/ON row layout and labels

### [x] T9: UI Controls (Padding Slider + Toggle Checkbox + Multi-Scale Display)

- **Description**: In `App.tsx`: replace old state-size radio buttons with padding slider (0–4px, default 2). Add toggle checkbox for ON/OFF generation. Remove size selector (multi-scale is mandatory). Show generated output summary listing 3 scale directories with file counts.
- **Files**: `src/App.tsx`
- **Dependencies**: T7, T8
- **Test strategy**: `vitest` render test verifies padding slider range and toggle checkbox presence
- **Acceptance**: Padding slider adjusts from 0–4 with value display; toggle checkbox toggles ON/OFF; output section shows 3 scale paths + file count

### [x] T10: Multi-Scale Install Panel

- **Description**: Update `InstallPanel` to display multi-scale output paths. Show file count per scale (e.g., "6 files → toolbar_icons/, 6 → toolbar_icons/150/, 6 → toolbar_icons/200/"). Update install action to use `installIconSet()`.
- **Files**: `src/InstallPanel.tsx`, `src/App.tsx`
- **Dependencies**: T7, T9
- **Test strategy**: `vitest` render test verifies multi-scale path display and file count summary
- **Acceptance**: Install panel shows 3 path entries with per-scale file counts; install triggers multi-scale copy

---

## Implementation Order

1. **Phase 1** builds the Rust foundation — everything depends on T1's HSB types and math
2. **Phase 2** completes the Rust backend with toggle + integration tests
3. **Phase 3** bridges Rust to the frontend via updated IPC + TypeScript types
4. **Phase 4** updates all UI components to use the new capabilities

Each phase is independently testable at the `cargo test` or `vitest` level. The Rust backend can be fully verified before any frontend work begins.

## Test Command Reference

| Layer | Command |
|-------|---------|
| Rust unit + integration | `cargo test --workspace` |
| Frontend vitest | `npx vitest run` |
| TypeScript check | `npx tsc --noEmit` |
