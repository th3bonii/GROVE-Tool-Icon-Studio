# Delta for visual-editor

## MODIFIED Requirements

### Requirement: 6-State Preview (was 3-State Preview)

The system MUST render a real-time preview of the six toolbar icon states (OFF/ON × Normal/Hover/Active) generated from the current crop region.
(Previously: 3 states — Normal, Hover, Click)

#### Scenario: Real-time 6-state preview updates

- GIVEN a crop region is selected
- WHEN the crop region changes
- THEN the preview MUST update within 200ms (debounced, max 16ms per frame)
- AND state dimensions and total output size MUST be displayed below the preview
- AND each state MUST be labeled with its OFF/ON × state combination

### Requirement: Auto-Install to REAPER (Multi-Scale)

The system MUST provide an "Install to REAPER" toggle and MUST write generated icons to REAPER's multi-scale directory structure.
(Previously: single directory toolbar_icons/{name}.png)

#### Scenario: Install multi-scale icons

- GIVEN the install toggle is enabled
- WHEN the icon is generated
- THEN files MUST be written to toolbar_icons/{name}.png (100%)
- AND toolbar_icons/150/{name}.png (150%)
- AND toolbar_icons/200/{name}.png (200%)
- AND the user MUST be able to name the icon file (default: source filename stem)

#### Scenario: List installed icons across scales

- GIVEN the install section is visible
- WHEN the user views installed icons
- THEN existing icons MUST be listed from all three scale directories

### Requirement: Process Icon with Crop (Updated)

The process_icon command MUST accept crop coordinates, optional padding, optional toggle flag, and scale. The pipeline MUST apply HSB deltas for 6 states and produce multi-scale output.
(Previously: crop + single size + 3 brightness states)

#### Scenario: Full params with padding and toggle

- GIVEN crop (x, y, w, h), padding=2, toggle=true, and scale=150% are passed
- WHEN the pipeline processes the image
- THEN it MUST crop the source to the specified region
- AND THEN apply padding inset
- AND THEN scale to 45px per state
- AND THEN apply HSB deltas for 6 states
- AND THEN produce multi-scale output

#### Scenario: Minimal params backward compatible

- GIVEN only crop coordinates are provided
- WHEN the pipeline processes the image
- THEN it MUST use defaults (padding=2px, toggle=off, scale=100%)
- AND the output MUST be a valid 6-state set

## REMOVED Requirements

### Requirement: Size Options

(Reason: Replaced by mandatory multi-scale output. 100%, 150%, and 200% are always generated — user no longer selects between standard and double-width.)

## ADDED Requirements

### Requirement: Padding Slider in UI

The UI MUST expose a padding slider (range 0-4px, default 2px) that controls the inset applied during icon generation.

#### Scenario: Padding slider interaction

- GIVEN the padding slider is visible in the generation panel
- WHEN the user adjusts it to 3px
- THEN the preview MUST update with the new padding applied
- AND the current numeric value MUST be displayed alongside the slider

### Requirement: Toggle Checkbox in UI

The UI MUST provide a toggle checkbox that controls whether ON variants are generated alongside OFF variants.

#### Scenario: Toggle checkbox enabled

- GIVEN the toggle checkbox is visible and unchecked
- WHEN the user checks it
- THEN the UI MUST show ON variant labels in the state preview
- AND the generated output MUST include _on.png files

### Requirement: Multi-Scale Output Display

The UI MUST display the generated output paths for all three scales and show total file counts.

#### Scenario: Output summary renders

- GIVEN generation completes with toggle enabled
- WHEN the output section renders
- THEN it MUST show the three scale directories
- AND the total file count summary (e.g., "18 files total: 6 per scale")
- AND each directory path MUST be clearly labeled
