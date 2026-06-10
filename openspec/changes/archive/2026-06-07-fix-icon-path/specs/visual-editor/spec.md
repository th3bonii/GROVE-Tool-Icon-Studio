# Delta for visual-editor

## ADDED Requirements

### Requirement: CSS Overflow Guard (Added)

The `.state-preview` CSS class MUST include `overflow-x: auto` to prevent horizontal overflow in strip preview containers.

#### Scenario: Horizontal scroll on overflow

- GIVEN a strip preview wider than its container
- WHEN the container has class `.state-preview`
- THEN it MUST render a horizontal scrollbar
- AND content MUST NOT be clipped or hidden

## MODIFIED Requirements

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
