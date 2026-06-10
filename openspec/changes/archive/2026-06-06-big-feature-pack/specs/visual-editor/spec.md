# Delta for visual-editor

## ADDED Requirements

### Requirement: HSB Slider Panels

The UI MUST provide 6 panels of HSB sliders grouped as OFF/ON × Normal/Hover/Active. Each panel MUST include: hue_shift (-180 to +180, step 1), sat_delta (-100 to +100, step 1), bri_delta (-100 to +100, step 1). Default adjustments MUST be all zeros.

#### Scenario: Slider changes update preview

- GIVEN the user moves any HSB slider
- WHEN the debounced preview resolves
- THEN the preview MUST reflect the adjusted HSB values
- AND the preview MUST NOT flicker or show intermediate states during drag

#### Scenario: Default values match existing output

- GIVEN all sliders are at default (zero) positions
- WHEN the preview renders
- THEN the output MUST be identical to current code with no adjustments

### Requirement: Strip Preview Toggle

StatePreview MUST support two view modes: "Per-State" (current) and "Full Strip". In strip view, it MUST render the complete 6-frame strip at readable size with scale label and file path pattern.

#### Scenario: Switch to strip view

- GIVEN the preview shows per-state frames
- WHEN the user toggles to strip view
- THEN the full 6-frame strip MUST render as a single image
- AND the scale label and path pattern MUST be displayed

### Requirement: Clickable Installed Icons

Each installed icon name in the list MUST be clickable. On click, the app MUST show a strip preview of that icon below the list.

#### Scenario: Click icon shows preview

- GIVEN a list of installed icons
- WHEN the user clicks an icon name
- THEN a strip preview of that icon MUST appear below the list

### Requirement: Delete Installed Icon

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

### Requirement: Export Installed Icon

The UI MUST provide an export action that opens a native save dialog and copies the selected installed strip file to the chosen path.

#### Scenario: Export saves strip

- GIVEN an installed icon preview is visible
- WHEN the user clicks export and selects a save path
- THEN the icon strip MUST be copied to the chosen path

### Requirement: Batch Mode Toggle

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
