# visual-editor Specification

## Purpose

Interactive visual editor for cropping source images, viewing real-time 3-state icon previews, and optionally installing generated icons to REAPER.

## Requirements

### Requirement: Canvas Cropper

The system MUST load a user-selected image onto an HTML Canvas element and MUST enable drag-based crop selection with a fixed 1:1 aspect ratio.

#### Scenario: Drag crop selection

- GIVEN the user has selected a source image
- WHEN the image is loaded onto the canvas
- THEN the user MUST be able to drag a crop selection rectangle
- AND the selection MUST maintain a 1:1 aspect ratio at all times
- AND crop coordinates (x, y, w, h) MUST be displayed in the UI
- AND the coordinates MUST be passed to the `process_icon` Rust command

### Requirement: 3-State Preview

The system MUST render a real-time preview of the three toolbar icon states (Normal, Hover, Click) generated from the current crop region.

#### Scenario: Real-time preview updates

- GIVEN a crop region is selected
- WHEN the crop region changes
- THEN the preview MUST update within 200ms (debounced, max 16ms per frame)
- AND state dimensions and total output size MUST be displayed below the preview

### Requirement: Auto-Install to REAPER

The system MUST provide an "Install to REAPER" toggle and MUST write generated icons to `{REAPER_resource_path}/Data/toolbar_icons/{name}.png` when enabled.

#### Scenario: Install icon on generation

- GIVEN the install toggle is enabled
- WHEN the icon is generated
- THEN the icon MUST be written to `{REAPER_resource_path}/Data/toolbar_icons/{name}.png`
- AND the user MUST be able to name the icon file (default: source filename stem)

#### Scenario: List installed icons

- GIVEN the install section is visible
- WHEN the user views installed icons
- THEN existing icons in the toolbar_icons directory MUST be listed for reference

### Requirement: Size Options

The system MUST offer standard (30x30 per state) and double-width (38x38 per state) size options, defaulting to standard.

#### Scenario: Size selection

- GIVEN the size selector is visible
- WHEN the user selects a size
- THEN standard (30x30 per state) MUST be the default
- AND the cropped region MUST be scaled to the selected state size before generation

### Requirement: Process Icon with Crop

The `process_icon` command MUST be extended to accept optional crop coordinates and a target size. Backward compatibility MUST be preserved when crop is omitted.

#### Scenario: Crop and size provided

- GIVEN crop (x, y, w, h) and target size are passed to `process_icon`
- WHEN the pipeline processes the image
- THEN it MUST crop the source to the specified region first
- AND THEN scale to the target state size
- AND THEN generate the three brightness-adjusted states

#### Scenario: No crop (backward compatible)

- GIVEN no crop coordinates are provided
- WHEN the pipeline processes the image
- THEN it MUST scale the entire image to the state size
- AND THEN generate the three brightness-adjusted states
