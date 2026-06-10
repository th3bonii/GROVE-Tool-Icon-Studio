# Delta for icon-processing-pipeline

## ADDED Requirements

### Requirement: Raw Byte Output Mode

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

## MODIFIED Requirements

### Requirement: Multi-Scale Generation (Added)

The pipeline MUST generate icon sets at defined scale values stored in a single shared constant. The `generate_icon_set()` function MUST return `Vec<ProcessingOutput>`.
(Previously: scales hardcoded at 100% (30px), 150% (45px), and 200% (60px))

#### Scenario: Three scales produced per icon

- GIVEN a source crop region
- WHEN `generate_icon_set()` is called
- THEN it MUST produce outputs at 30px, 45px, and 60px per state
- AND each scale MUST contain all 6 states
- AND each scale value MUST reference the shared constant

#### Scenario: Single source of truth for scales

- GIVEN the scale constant is defined in one location
- WHEN any consumer reads scale values
- THEN ALL consumers MUST reference the shared constant
- AND there MUST NOT be duplicate hardcoded scale lists
