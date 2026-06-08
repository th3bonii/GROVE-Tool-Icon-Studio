# Delta for visual-editor

## MODIFIED Requirements

### Requirement: 3-State Preview (was 6-State Preview)

The system MUST render a real-time preview of three toolbar icon states (Normal/Hover/Active) from the current crop region. For toggle icons, the preview MUST show separate OFF and ON 3-state strips. On failure, the preview area MUST display a visible error state.
(Previously: 6 states — OFF/ON × Normal/Hover/Active in a single strip)

#### Scenario: Real-time 3-state preview

- GIVEN a crop region is selected
- WHEN the crop region changes
- THEN the preview MUST update within 200ms (debounced)
- AND each state MUST be labeled by name (Normal, Hover, Active)
- AND toggle mode MUST show both OFF and ON 3-state strips

#### Scenario: Preview error state

- GIVEN the pipeline fails to process the crop region
- WHEN the error is returned to the UI
- THEN the preview area MUST show a visible error message distinct from loading

### Requirement: Process Icon with Crop (Updated)

The process_icon command MUST accept crop coordinates, optional padding, optional toggle flag, and scale. The pipeline MUST apply HSB deltas for 3 states per strip and produce multi-scale output.
(Previously: apply HSB deltas for 6 states per strip)

#### Scenario: Full params with toggle

- GIVEN crop (x, y, w, h), padding=2, toggle=true, scale=150%
- WHEN the pipeline processes the image
- THEN it MUST crop, pad, scale to 45px per state
- AND apply HSB deltas for 3 states per strip
- AND produce OFF and ON strips at multi-scale output

#### Scenario: Minimal params

- GIVEN only crop coordinates are provided
- WHEN the pipeline processes
- THEN it MUST use defaults (padding=2, toggle=off, scale=100%)
- AND output MUST be a valid 3-state strip

### Requirement: HSB Slider Panels (Added)

The UI MUST provide 3 panels of HSB sliders grouped as Normal/Hover/Active. Each panel: hue_shift (-180 to +180), sat_delta (-100 to +100), bri_delta (-100 to +100). Defaults: all zeros. In toggle mode, provide separate OFF and ON sets, each with 3 panels.
(Previously: 6 panels — OFF/ON × Normal/Hover/Active)

#### Scenario: Slider updates preview

- GIVEN the user moves any HSB slider
- WHEN the debounced preview resolves
- THEN the preview MUST reflect the adjusted HSB values
- AND MUST NOT flicker during drag

#### Scenario: Default values

- GIVEN all sliders at default (zero) positions
- WHEN the preview renders
- THEN output MUST be identical to unadjusted code

### Requirement: Strip Preview Toggle (Added)

StatePreview MUST support "Per-State" and "Full Strip" views. Strip view MUST render the complete 3-frame strip with scale label and file path pattern.
(Previously: 6-frame strip)

#### Scenario: Switch to strip view

- GIVEN the preview shows per-state frames
- WHEN the user toggles to strip view
- THEN the full 3-frame strip MUST render as a single image
- AND the scale label and path pattern MUST display
