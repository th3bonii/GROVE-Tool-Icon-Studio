# Delta for icon-processing-pipeline

## MODIFIED Requirements

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

### Requirement: Multi-Scale Generation (Added)

The pipeline MUST generate icon sets at defined scale values stored in a single shared constant. The `generate_icon_set()` function MUST return `Vec<ProcessingOutput>`.
(Previously: hardcoded at 100% (30px), 150% (45px), and 200% (60px))

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

### Requirement: IPC HSB Parameters (Added)

All 3 IPC commands (process_icon, preview_icon, install_icon_set) MUST accept optional `off_adjustments` and `on_adjustments` parameters, each typed as `[HsbAdjustment; 3]`. When omitted, they MUST default to all-zero adjustments. The 3 adjustments in each array now map to Normal/Hover/Active respectively.
(Previously: [OFF_N, OFF_H, OFF_A] and [ON_N, ON_H, ON_A] — semantic unchanged, iteration produces 3 states per call)

#### Scenario: HSB adjustments mapped to 3 states

- GIVEN the user provides non-zero HSB adjustments for 3 states
- WHEN either IPC command executes with one adjustment set
- THEN the output strip MUST contain exactly 3 states with applied HSB deltas
- AND the alpha channel MUST remain unchanged

#### Scenario: Default HSB preserves existing output

- GIVEN the user calls any IPC command without HSB parameters
- WHEN the command executes
- THEN the output MUST be all-zero adjustments as before
