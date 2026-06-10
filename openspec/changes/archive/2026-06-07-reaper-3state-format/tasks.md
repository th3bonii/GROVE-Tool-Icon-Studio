# Tasks: Fix REAPER 3-State Icon Format

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~60-80 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Core Pipeline — `src-tauri/src/image_processor.rs`

- [x] 1.1 Change `REAPER_STATES` constant: `6` → `3` (line 6)
- [x] 1.2 Change `process_padded_to_bytes` adjustments param: `&[&HsbAdjustment; 6]` → `&[&HsbAdjustment; 3]` (line 492)
- [x] 1.3 Update `process_padded_to_bytes` doc comment: "6-state" → "3-state" (line 48, line 195)
- [x] 1.4 Simplify `build_adjustments`: return `[&HsbAdjustment; 3]`, remove `is_toggle` parameter/branching, emit only 3 refs matching the variant (lines 518-553)
- [x] 1.5 Update `generate_icon_set`/`generate_icon_set_raw` doc comments: "6-state" → "3-state" (lines 566-571, 648+)

## Phase 2: Frontend — `src/StatePreview.tsx`

- [x] 2.1 Change `getStripScale` multiplier: `scaleNum * 6` → `scaleNum * 3` (line 27)
- [x] 2.2 Change `backgroundSize` multipliers: `scale * 6` → `scale * 3` (lines 136, 170)
- [x] 2.3 Change `renderStripView` strip width: `scale * 6` → `scale * 3` (line 206)

## Phase 3: Test Assertions — Rust

- [x] 3.1 Update `generate_icon_set_raw` test: `(30,180)→(30,90)`, `(45,270)→(45,135)`, `(60,360)→(60,180)` (lines 1114-1120)
- [x] 3.2 Update `generate_icon_set` test `expected_dims` + comment (lines 1503-1509)
- [x] 3.3 Update preview base64 test: `180`→`90`, "6-state"→"3-state" (lines 1556-1564)
- [x] 3.4 Update 30px test: `180`→`90`, "6 states"→"3 states" (line 1604)
- [x] 3.5 Rename & update `toggle_each_variant_is_6_state` → `toggle_each_variant_is_3_state`, width `180`→`90` (lines 2212-2241)
- [x] 3.6 Update `full_pipeline_produces_valid_toggle_output`: `180→90, 270→135, 360→180`, "6-state"→"3-state" (lines 2362-2381)
- [x] 3.7 Rework `state_ordering_follows_reaper_convention`: non-toggle now produces 3 OFF states only — width `96→48`, iterate 3 states (lines 2388-2462)

## Phase 4: Test Assertions — Frontend

- [x] 4.1 Change `StatePreview.test.tsx` mock: `width: height * 6` → `height * 3` (line 11)
- [x] 4.2 Change `useIconPreview.test.tsx` mock: `width: height * 6` → `height * 3` (line 13)

## Phase 5: Verification

- [x] 5.1 `cargo test` passes with all updated assertions
- [x] 5.2 `npx tsc -b` compiles without errors
- [x] 5.3 `npx vitest run` passes
