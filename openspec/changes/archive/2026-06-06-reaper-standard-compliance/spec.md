# REAPER Standard Compliance

## Purpose

Align icon generation with REAPER's native standard: HSB-based 6-state adjustments, configurable padding, multi-scale output (100%/150%/200%), and toggle ON/OFF dual-file generation.

## Requirements

### Requirement: 6-State HSB Adjustments

The system MUST replace additive RGB brightness with HSB delta adjustments for 6 icon states: OFF Normal, OFF Hover, OFF Active, ON Normal, ON Hover, ON Active. All hue shifts MUST be 0° per REAPER spec, and each state MUST carry its own saturation and brightness deltas.

#### Scenario: HSB deltas applied per state

- GIVEN an input icon and 6 HSB adjustment configs
- WHEN the pipeline processes the icon
- THEN each state MUST use its own {hue_shift: 0°, sat_delta: X, bri_delta: Y}
- AND the OFF Active state MUST apply the correct REAPER brightness delta

#### Scenario: Hue shift locked at 0°

- GIVEN any HSB adjustment configuration
- WHEN computing any of the 6 states
- THEN hue_shift MUST be 0° for all six states

### Requirement: Configurable Padding

The system MUST support inset padding of 0-4px (default 2px). The icon MUST be scaled to (canvas_size - 2 × padding) and centered on a transparent canvas.

#### Scenario: Default padding applied

- GIVEN a 30px canvas with default 2px padding
- WHEN the icon is rendered
- THEN the icon MUST fill 26×26px and be centered on the canvas

#### Scenario: Zero padding edge case

- GIVEN padding is set to 0px
- WHEN the icon is rendered
- THEN the icon MUST fill the full 30×30px canvas without inset

### Requirement: Multi-Scale Output

The system MUST generate icons at 100% (30px), 150% (45px), and 200% (60px) per state. Files MUST be placed in toolbar_icons/, toolbar_icons/150/, and toolbar_icons/200/ directories respectively.

#### Scenario: Three scale directories created

- GIVEN a source icon and a name
- WHEN multi-scale generation completes
- THEN files MUST exist at all three scale directories
- AND each directory MUST contain the correct pixel dimensions per state

### Requirement: Toggle ON/OFF Generation

When toggle mode is enabled, the system MUST generate both {name}.png (OFF variant) and {name}_on.png (ON variant) across all 3 scales and 6 states.

#### Scenario: Toggle mode enabled

- GIVEN toggle mode is enabled and name is "myicon"
- WHEN generation completes
- THEN 6 files MUST exist per scale (OFF/ON × 3 states)
- AND ON files MUST use the _on.png suffix

#### Scenario: Toggle mode disabled

- GIVEN toggle mode is disabled
- WHEN generation completes
- THEN only OFF variants MUST be generated
- AND no _on.png files MUST exist
