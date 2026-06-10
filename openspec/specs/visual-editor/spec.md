# visual-editor Specification

## Purpose

Interactive visual editor for cropping source images, viewing real-time 3-state icon previews with padding/toggle controls, and installing generated icons to REAPER's multi-scale directory structure.

## Requirements

### Requirement: Canvas Cropper

The system MUST load a user-selected image onto an HTML Canvas element and MUST enable drag-based crop selection with a fixed 1:1 aspect ratio. The cropper MUST support keyboard arrow nudge and MUST provide ARIA attributes for accessibility.

#### Scenario: Drag crop selection

- GIVEN the user has selected a source image
- WHEN the image is loaded onto the canvas
- THEN the user MUST be able to drag a crop selection rectangle
- AND the selection MUST maintain a 1:1 aspect ratio at all times
- AND crop coordinates (x, y, w, h) MUST be displayed in the UI
- AND the coordinates MUST be passed to the `process_icon` Rust command

#### Scenario: Keyboard nudge adjusts crop

- GIVEN the crop rectangle is active on the canvas
- WHEN the user presses arrow keys
- THEN the crop SHALL nudge by 1px in the arrow direction
- AND SHIFT+arrow SHALL nudge by 10px
- AND the cropper element MUST have `role` and `aria-label` attributes

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

### Requirement: Auto-Install to REAPER (Multi-Scale)

The system MUST provide an "Install to REAPER" toggle and MUST write generated icons to REAPER's multi-scale directory structure.
(Previously: single directory toolbar_icons/{name}.png)

#### Scenario: Install multi-scale icons with Data/ prefix

- GIVEN the install toggle is enabled
- WHEN the icon is generated
- THEN files MUST be written to Data/toolbar_icons/{name}.png (100%)
- AND Data/toolbar_icons/150/{name}.png (150%)
- AND Data/toolbar_icons/200/{name}.png (200%)
- AND the user MUST be able to name the icon file (default: source filename stem)
(Previously: files written to toolbar_icons/ without Data prefix)

#### Scenario: List installed icons across scales

- GIVEN the install section is visible
- WHEN the user views installed icons
- THEN existing icons MUST be listed from all three scale directories

### Requirement: CSS Overflow Guard

The `.state-preview` CSS class MUST include `overflow-x: auto` to prevent horizontal overflow in strip preview containers.

#### Scenario: Horizontal scroll on overflow

- GIVEN a strip preview wider than its container
- WHEN the container has class `.state-preview`
- THEN it MUST render a horizontal scrollbar
- AND content MUST NOT be clipped or hidden

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

(REMOVED: Size Options — Replaced by mandatory multi-scale output. 100%, 150%, and 200% are always generated — user no longer selects between standard and double-width.)

### Requirement: Padding Slider in UI (Added)

The UI MUST expose a padding slider (range 0-4px, default 2px) that controls the inset applied during icon generation.

#### Scenario: Padding slider interaction

- GIVEN the padding slider is visible in the generation panel
- WHEN the user adjusts it to 3px
- THEN the preview MUST update with the new padding applied
- AND the current numeric value MUST be displayed alongside the slider

### Requirement: Toggle Checkbox in UI (Added)

The UI MUST provide a toggle checkbox that controls whether ON variants are generated alongside OFF variants.

#### Scenario: Toggle checkbox enabled

- GIVEN the toggle checkbox is visible and unchecked
- WHEN the user checks it
- THEN the UI MUST show ON variant labels in the state preview
- AND the generated output MUST include _on.png files

### Requirement: Multi-Scale Output Display (Added)

The UI MUST display the generated output paths for all three scales and show total file counts.

#### Scenario: Output summary renders

- GIVEN generation completes with toggle enabled
- WHEN the output section renders
- THEN it MUST show the three scale directories
- AND the total file count summary (e.g., "18 files total: 6 per scale")
- AND each directory path MUST be clearly labeled

### Requirement: ErrorBoundary Root Wrapper (Added)

The application root MUST be wrapped in an ErrorBoundary component that catches unhandled render errors and displays a fallback UI.

#### Scenario: ErrorBoundary catches render crash

- GIVEN a child component throws during rendering
- WHEN the error propagates to the ErrorBoundary
- THEN the ErrorBoundary MUST display a fallback message
- AND the app MUST NOT show a white screen or crash entirely

#### Scenario: ErrorBoundary allows recovery

- GIVEN the ErrorBoundary has caught an error
- WHEN the user clicks a retry control
- THEN the boundary MUST attempt to re-render children
- AND the fallback MUST provide a clear "try again" action

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

### Requirement: Clickable Installed Icons (Added)

Each installed icon name in the list MUST be clickable. On click, the app MUST show a strip preview of that icon below the list.

#### Scenario: Click icon shows preview

- GIVEN a list of installed icons
- WHEN the user clicks an icon name
- THEN a strip preview of that icon MUST appear below the list

### Requirement: Delete Installed Icon (Added)

The UI MUST provide a delete action for installed icons. Delete MUST trigger a confirmation dialog before removing `icon_name.png` from all 3 scale directories.

#### Scenario: Delete with confirmation

- GIVEN an installed icon is selected
- WHEN the user clicks delete and confirms
- THEN the icon MUST be removed from all 3 scale directories
- AND the list MUST refresh

#### Scenario: Delete cancelled

- GIVEN the delete confirmation is shown
- WHEN the user cancels
- THEN no files MUST be deleted

### Requirement: Export Installed Icon (Added)

The UI MUST provide an export action that opens a native save dialog and copies the selected installed strip file to the chosen path.

#### Scenario: Export saves strip

- GIVEN an installed icon preview is visible
- WHEN the user clicks export and selects a save path
- THEN the icon strip MUST be copied to the chosen path

### Requirement: Batch Mode Toggle (Added)

The UI MUST provide a toggle enabling batch mode. When active: file selector MUST allow multiple files, selected files MUST display with status (pending/processing/done/error), and Process All MUST iterate sequentially. All files MUST share the same crop/padding/toggle/HSB settings.

#### Scenario: Process multiple files

- GIVEN batch mode is enabled with 3 files selected
- WHEN the user clicks Process All
- THEN each file MUST be processed sequentially
- AND each file's status MUST update from pending → processing → done
- AND each file MUST be auto-named by its filename stem

#### Scenario: Batch with errors

- GIVEN batch mode with one invalid file among valid ones
- WHEN Process All completes
- THEN the valid files MUST show status "done"
- AND the invalid file MUST show status "error"
- AND other files MUST NOT be blocked
