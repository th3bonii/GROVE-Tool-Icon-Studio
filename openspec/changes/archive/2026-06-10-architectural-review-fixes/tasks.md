# Tasks: Architectural Review Fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Rust Core Refactors (image_processor.rs + lib.rs)

- [x] 1.1 Add `CORNER_RADIUS_FACTOR` const and `icon_corner_radius()` in `image_processor.rs` — const at top level after `REAPER_SCALE_DIRS`; fn before `process_padded_to_bytes`. Replace `0.15` on lines 289 and 516 with `icon_corner_radius()` call.
- [x] 1.2 Extract `build_icon_config()` fn in `lib.rs` — free fn before `process_icon` that builds `IconConfig` from `Option` params. Replace the 3 inline blocks with calls to it.
- [x] 1.3 Remove `SOURCE_CACHE` in `image_processor.rs` — delete `CachedSource`, `SOURCE_CACHE`, `hash_crop`, `load_source_cached`. Replace with simple `load_source()` using direct `image::open()` + center-crop. Remove `use std::sync::Mutex;`.

## Phase 2: TypeScript Fixes (App.tsx + useBatchProcessing.ts + api.ts + StatePreview.tsx)

- [x] 2.1 Remove double processing in `App.tsx` — remove auto-install block, remove `handleAutoInstall` from deps array. All TS tests pass.
- [x] 2.2 Export `CORNER_RADIUS_FACTOR = 0.15` constant in `src/api.ts` — added after `ProcessingResult` type alias.
- [x] 2.3 Fix stale closure in `useBatchProcessing.ts` — add `useRef`/`useEffect` imports, `filesRef` synced every render. `processAll` captures `filesRef.current`, drops `[files]` dep.
- [x] 2.4 Extract `getCornerRadius()` in `StatePreview.tsx` — import `CORNER_RADIUS_FACTOR`, exported function, replaces both inline `0.15` references.

## Phase 3: Test Updates & Verification

- [x] 3.1 Remove 8 cache-related tests in `image_processor.rs` — all cache tests removed, including `clear_cache` helper.
- [x] 3.2 Add Rust test for `CORNER_RADIUS_FACTOR` — `corner_radius_factor_has_correct_value` + `icon_corner_radius_computes_correctly` tests with 4 cases.
- [x] 3.3 Add Rust tests for `build_icon_config()` — 5 tests covering defaults, padding, toggle, off_adjustments, on_adjustments.
- [x] 3.4 Add TS test for corner radius — `getCornerRadius` tested in `StatePreview.test.tsx` (5 cases), `CORNER_RADIUS_FACTOR` tested in `api.test.ts` (1 case).
- [x] 3.5 Run full test suite — Rust 104 ✅, TS 120 ✅. All existing tests pass (cache tests removed as expected).
