# Delta for visual-editor

## ADDED Requirements

### Requirement: ErrorBoundary Root Wrapper

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

## MODIFIED Requirements

### Requirement: Canvas Cropper

The system MUST load a user-selected image onto an HTML Canvas element and MUST enable drag-based crop selection with a fixed 1:1 aspect ratio. The cropper MUST support keyboard arrow nudge and MUST provide ARIA attributes for accessibility.
(Previously: no keyboard or ARIA support)

#### Scenario: Drag crop selection

- GIVEN the user has selected a source image
- WHEN the image is loaded onto the canvas
- THEN the user MUST be able to drag a crop selection rectangle
- AND the selection MUST maintain a 1:1 aspect ratio at all times
- AND crop coordinates MUST be displayed in the UI
- AND the coordinates MUST be passed to the `process_icon` command

#### Scenario: Keyboard nudge adjusts crop

- GIVEN the crop rectangle is active on the canvas
- WHEN the user presses arrow keys
- THEN the crop SHALL nudge by 1px in the arrow direction
- AND SHIFT+arrow SHALL nudge by 10px
- AND the cropper element MUST have `role` and `aria-label` attributes

### Requirement: 6-State Preview (was 3-State Preview)

The system MUST render a real-time preview of the six toolbar icon states (OFF/ON x Normal/Hover/Active) generated from the current crop region. On processing failure, the preview area MUST display a visible error state.
(Previously: no error surfacing on failure)

#### Scenario: Real-time 6-state preview updates

- GIVEN a crop region is selected
- WHEN the crop region changes
- THEN the preview MUST update within 200ms (debounced)
- AND state dimensions MUST be displayed below the preview
- AND each state MUST be labeled with its OFF/ON x state combination

#### Scenario: Preview shows error on pipeline failure

- GIVEN the pipeline fails to process the crop region
- WHEN the error is returned to the UI
- THEN the preview area MUST show an error message
- AND the error state MUST be visually distinct from a loading spinner or empty state
