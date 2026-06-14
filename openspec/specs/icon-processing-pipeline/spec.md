# icon-processing-pipeline Specification

## Purpose

Rust-based pixel-level image processing for the 3-state REAPER toolbar format, supporting HSB deltas, configurable padding, multi-scale output, and toggle ON/OFF generation.

## Requirements

### Requirement: 3-State Generation (was 6-State Generation)

The system MUST process an input image into a 3-state REAPER toolbar icon covering Normal/Hover/Active states using per-state HSB deltas. For toggle icons, the pipeline runs twice producing separate OFF and ON 3-state strips.
(Previously: 6 states per file — OFF/ON × Normal/Hover/Active, combined in one strip)

#### Scenario: 3-state icon generation

- GIVEN an input test image and 3 HSB adjustment configurations
- WHEN passed through the image processing pipeline
- THEN it MUST output an image with exactly three horizontally stacked states (Normal, Hover, Active)

#### Scenario: State ordering matches REAPER convention

- GIVEN a generated 3-state icon
- WHEN the states are laid out horizontally
- THEN the order MUST be: Normal, Hover, Active

#### Scenario: Toggle produces two 3-state strips

- GIVEN is_toggle=true
- WHEN the pipeline processes the image
- THEN it MUST produce OFF strip (Normal/Hover/Active) as {name}.png
- AND ON strip (Normal/Hover/Active) as {name}_on.png

### Requirement: Dimension Constraints (Updated)

The generated icon MUST adhere to REAPER's toolbar dimensions. Width MUST be 3 × state_width and height = state_height.
(Previously: width = 6 × W)

#### Scenario: 3-state dimension formatting

- GIVEN a valid input image of width W and height H
- WHEN processed
- THEN the output image dimensions MUST be width = 3 × W and height = H
- AND the 3 states MUST be distributed evenly across the width

### Requirement: HSB Transformation (was Pixel Accuracy)

The image processing MUST apply per-state HSB delta adjustments. The `bri_delta` and `sat_delta` values MUST be divided by 100.0 before applying as offsets to the pixel's HSB components. The alpha channel MUST be preserved unchanged.
(Previously: additive RGB brightness adjustments; sat_delta applied as raw offset without ÷100 scaling)

#### Scenario: HSB delta applied per pixel

- GIVEN an input pixel with RGB values
- WHEN computing any state
- THEN the pixel MUST be converted to HSB
- AND `bri_delta / 100.0` MUST be added to the brightness component
- AND `sat_delta / 100.0` MUST be added to the saturation component
- AND the result MUST be converted back to RGB
- AND the alpha channel MUST be preserved unchanged

#### Scenario: Intermediate sat_delta produces linear effect

- GIVEN sat_delta values of -50, -25, 25, and 50
- WHEN `apply_hsb` processes identical pixels
- THEN output saturation MUST scale linearly with input
- AND sat_delta = 50 MUST produce double the shift of sat_delta = 25

#### Scenario: Alpha channel preservation

- GIVEN an input image with transparent pixels
- WHEN processed into the 6-state format
- THEN the transparency MUST be correctly preserved in all six states

### Requirement: Configurable Padding (Added)

The pipeline MUST support an optional padding parameter (0-4px, default 2px) that insets the icon within the canvas.

#### Scenario: Padding inset logic

- GIVEN padding is set to 2px on a 30px canvas
- WHEN the pipeline processes the icon
- THEN the icon MUST be scaled to 26×26px and centered
- AND the surrounding 2px border MUST be transparent

#### Scenario: Padding at maximum value

- GIVEN padding is set to 4px on a 30px canvas
- WHEN the pipeline processes the icon
- THEN the icon MUST be scaled to 22×22px and centered

### Requirement: Multi-Scale Generation (Added)

The pipeline MUST generate icon sets at defined scale values stored in a single shared constant. The `generate_icon_set()` function MUST return `Vec<ProcessingOutput>`.
(Previously: scales hardcoded at 100% (30px), 150% (45px), and 200% (60px))

#### Scenario: Three scales produced per icon (Updated)

- GIVEN a source crop region
- WHEN `generate_icon_set()` is called
- THEN it MUST produce outputs at 30px, 45px, and 60px per state
- AND each scale MUST contain 3 states per strip
- AND each scale value MUST reference the shared constant
(Previously: each scale contained all 6 states)

#### Scenario: Single source of truth for scales

- GIVEN the scale constant is defined in one location
- WHEN any consumer reads scale values
- THEN ALL consumers MUST reference the shared constant
- AND there MUST NOT be duplicate hardcoded scale lists

#### Scenario: Scale directories include Data/ prefix

- GIVEN the scale constant `REAPER_SCALE_DIRS`
- WHEN generating install paths
- THEN the directory list MUST be `["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"]`
- AND ALL consumers MUST reference this shared constant
(Previously: `["", "150", "200"]`)

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

#### Scenario: Minimum radius floor enforced

- GIVEN any scale value
- WHEN the corner radius is computed
- THEN the result MUST be at least 2.0

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

### Requirement: Toggle ON/OFF Output (Added)

When is_toggle is true, the pipeline MUST run twice per scale — once with OFF adjustments, once with ON adjustments — producing {name}.png and {name}_on.png.

#### Scenario: Toggle mode dual file output

- GIVEN is_toggle=true and name "myicon"
- WHEN processing completes
- THEN OFF variant MUST be written as myicon.png
- AND ON variant MUST be written as myicon_on.png

#### Scenario: Non-toggle single file output

- GIVEN is_toggle=false
- WHEN processing completes
- THEN only OFF variant MUST be generated
- AND no _on.png file MUST exist for any scale

### Requirement: Raw Byte Output Mode (Added)

`generate_icon_set` MUST support an optional raw byte output mode that returns image bytes directly instead of base64-encoded strings.

#### Scenario: Raw output skips base64

- GIVEN `generate_icon_set` is called with `raw_output=true`
- WHEN processing completes
- THEN the output MUST contain raw PNG bytes
- AND the base64 encoding step MUST be skipped

#### Scenario: Default output unaffected

- GIVEN `generate_icon_set` is called without `raw_output`
- WHEN processing completes
- THEN the output MUST be base64-encoded as before
- AND existing callers MUST function identically

### Requirement: IPC HSB Parameters

All 3 IPC commands (process_icon, preview_icon, install_icon_set) MUST accept optional `off_adjustments` and `on_adjustments` parameters, each typed as `[HsbAdjustment; 3]`. When omitted, they MUST default to all-zero adjustments. The 3 adjustments in each array map to Normal/Hover/Active respectively.
(Previously: [OFF_N, OFF_H, OFF_A] and [ON_N, ON_H, ON_A] — semantic unchanged, iteration produces 3 states per call)

All 3 IPC commands MUST build `IconConfig` through a shared `build_icon_config(padding, is_toggle, off_adj, on_adj)` function in `lib.rs`.
(Previously: each of `process_icon`, `preview_icon`, `install_icon_set` built `IconConfig` inline with identical 7-line blocks)

The `process_icon` command MUST propagate write failures as `Err` to the caller instead of silently logging and returning `Ok`.
(Previously: process_icon silently logged write errors and returned Ok)

#### Scenario: HSB adjustments mapped to 3 states

- GIVEN the user provides non-zero HSB adjustments for 3 states
- WHEN either IPC command executes with one adjustment set
- THEN the output strip MUST contain exactly 3 states with applied HSB deltas
- AND the alpha channel MUST remain unchanged

#### Scenario: Default HSB preserves existing output

- GIVEN the user calls any IPC command without HSB parameters
- WHEN the command executes
- THEN the output MUST be all-zero adjustments as before

#### Scenario: Shared builder produces identical configs

- GIVEN identical parameters
- WHEN passed through `build_icon_config` vs the old inline construction
- THEN the resulting `IconConfig` MUST have identical field values

#### Scenario: All 3 commands accept all param combinations

- GIVEN the shared builder
- WHEN `process_icon`, `preview_icon`, and `install_icon_set` are called with any combination of optional params (None/Some)
- THEN all existing IPC command tests MUST pass unchanged

#### Scenario: Write failure returns Err

- GIVEN a target directory with insufficient write permissions
- WHEN `process_icon` attempts to write output files
- THEN the command MUST return an `Err` result
- AND no partial output MUST be reported as success

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
