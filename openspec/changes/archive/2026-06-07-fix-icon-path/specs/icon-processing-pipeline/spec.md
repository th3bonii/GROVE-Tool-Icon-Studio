# Delta for icon-processing-pipeline

## ADDED Requirements

### Requirement: Corner Radius Calculation (Added)

The system MUST compute corner radius using a floor-based formula: `((scale as f32) * 0.15 + 0.5).floor().max(2.0)`, replacing the previous `round()`-based calculation to avoid ties-to-even bias at small sizes.

#### Scenario: 30px icon produces radius=5

- GIVEN the scale is 30px
- WHEN the corner radius is computed
- THEN the result MUST be 5 (not 4)

#### Scenario: Minimum radius floor enforced

- GIVEN any scale value
- WHEN the corner radius is computed
- THEN the result MUST be at least 2.0

### Requirement: Dead Code Removal (Added)

The `apply_rounded_rect_mask` function MUST NOT contain a `dx <= 0.0 || dy <= 0.0` early-return branch, as this path is unreachable given valid dimension inputs.

#### Scenario: Branch removed from hot path

- GIVEN an icon with valid positive dimensions
- WHEN `apply_rounded_rect_mask` executes
- THEN it MUST NOT short-circuit via `dx <= 0.0 || dy <= 0.0`
- AND corner rounding MUST always apply

## MODIFIED Requirements

### Requirement: Multi-Scale Generation (Added)

The pipeline MUST generate icon sets at defined scale values stored in a single shared constant. `generate_icon_set()` MUST return `Vec<ProcessingOutput>`.

#### Scenario: Three scales produced per icon

- GIVEN a source crop region
- WHEN `generate_icon_set()` is called
- THEN it MUST produce outputs at 30px, 45px, and 60px per state
- AND each scale MUST contain all 6 states
- AND each scale value MUST reference the shared constant

#### Scenario: Scale directories include Data/ prefix (Added)

- GIVEN the scale constant `REAPER_SCALE_DIRS`
- WHEN generating install paths
- THEN the directory list MUST be `["Data", "Data/150", "Data/200"]`
- AND ALL consumers MUST reference this shared constant
(Previously: `["", "150", "200"]`)

#### Scenario: Single source of truth for scales

- GIVEN the scale constant is defined in one location
- WHEN any consumer reads scale values
- THEN ALL consumers MUST reference the shared constant
- AND there MUST NOT be duplicate hardcoded scale lists
