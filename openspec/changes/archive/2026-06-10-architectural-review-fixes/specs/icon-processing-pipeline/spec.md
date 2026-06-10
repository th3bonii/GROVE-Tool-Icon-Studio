# Delta for icon-processing-pipeline

Cross-domain scope: also covers app-shell (Fix 1) and batch-processing (Fix 4).

## MODIFIED Requirements

### Requirement: Corner Radius Calculation

The corner radius formula MUST be defined in a single shared Rust constant and imported by the TypeScript frontend. The formula MUST remain `((size as f32) * 0.15 + 0.5).floor().max(2.0)`.
(Previously: duplicated across `image_processor.rs` (lines 289, 516) and `StatePreview.tsx` (lines 107, 210))

#### Scenario: Rust and TS compute identical radii

- GIVEN scale values 1, 30, 45, 60
- WHEN computed by both Rust and TS implementations
- THEN ALL computed radii MUST match exactly between the two

#### Scenario: 30px icon produces radius=5 after refactor

- GIVEN the Rust constant is extracted
- WHEN `generate_icon_set` runs at 30px scale
- THEN the pixel (1,1) alpha MUST still be < 200 (existing behavioral test passes)

### Requirement: Dead Code Removal

The `SOURCE_CACHE` module MUST be removed. All callers MUST load images directly via `image::open()` without caching.
(Previously: `load_source_cached()` wrapped `image::open()` with Mutex-protected single-entry cache)

#### Scenario: Icon generation succeeds without cache

- GIVEN `SOURCE_CACHE` is removed
- WHEN `generate_icon_set` or `generate_icon_set_raw` processes any input
- THEN output dimensions and pixel data MUST match the pre-removal version
- AND `cargo test` MUST pass all existing tests

#### Scenario: Batch mode no slower after cache removal

- GIVEN 5 distinct source images
- WHEN processed sequentially as a batch
- THEN total wall time MUST NOT exceed 2× the pre-removal time

### Requirement: IPC HSB Parameters

All 3 IPC commands MUST build `IconConfig` through a shared `build_icon_config(padding, is_toggle, off_adj, on_adj)` function in `lib.rs`.
(Previously: each of `process_icon`, `preview_icon`, `install_icon_set` built `IconConfig` inline with identical 7-line blocks)

#### Scenario: Shared builder produces identical configs

- GIVEN identical parameters
- WHEN passed through `build_icon_config` vs the old inline construction
- THEN the resulting `IconConfig` MUST have identical field values

#### Scenario: All 3 commands accept all param combinations

- GIVEN the shared builder
- WHEN `process_icon`, `preview_icon`, and `install_icon_set` are called with any combination of optional params (None/Some)
- THEN all existing IPC command tests MUST pass unchanged

## ADDED Verification Requirements

### Requirement: No Double Processing in Generate Flow

The `handleGenerate` callback in `App.tsx` MUST call `processAndGenerate` once. It MUST NOT call `handleAutoInstall` or any additional `installIconSet` invocation.
(Reason: batch processing has a separate install step; the single generate call writes to `Data/toolbar_icons/` directly)

#### Scenario: Single generate call with auto-install disabled

- GIVEN auto-install is unchecked
- WHEN user clicks "Generate 3-State Icon"
- THEN `processIcon` IPC fires exactly once
- AND `installIconSet` IPC does NOT fire

#### Scenario: Auto-install flow still available via InstallPanel

- GIVEN a generated icon exists in `Data/toolbar_icons/`
- WHEN user clicks "Install" in the InstallPanel
- THEN `installIconSet` MUST fire and install correctly

### Requirement: Stale-Free Batch Files Reference

The `processAll` callback in `useBatchProcessing` MUST reference the current files array at call time, not a closure-captured reference.
(Reason: `useCallback([files])` captures `files` at memoization time; if files change between render and click, the loop reads stale data)

#### Scenario: Late-added files are processed

- GIVEN 2 files loaded in batch mode
- WHEN a 3rd file is added AND "Process All" is clicked in the same render cycle
- THEN all 3 files MUST be processed

#### Scenario: Removed files excluded from processing

- GIVEN 3 files loaded in batch mode
- WHEN file at index 1 is removed AND "Process All" starts
- THEN only the remaining 2 files MUST be processed
- AND total progress MUST be "2 of 2"
