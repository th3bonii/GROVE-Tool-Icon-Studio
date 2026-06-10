# Layout & Window Sizing Specification

## Purpose

Define layout and window constraints ensuring the core icon editing workflow (source selection, crop, preview, HSB, install, generate) fits without vertical scrolling at the minimum window size.

## Requirements

### Requirement: Window Minimum Size

The application window MUST have a minimum size of 800×850px. The window SHALL NOT be resizable below these dimensions.

#### Scenario: Core workflow fits at minimum size

- GIVEN the window is at 800×850px
- WHEN the user has selected a source image and completed a crop
- THEN all core sections MUST be visible without vertical scrolling
- AND the Generate button MUST be the last visible element

#### Scenario: Graceful degradation below minimum

- GIVEN the window is smaller than the minimum size
- WHEN overflow occurs
- THEN the container MUST support vertical scrolling
- AND no content SHALL be clipped or hidden

### Requirement: Scrollable Installed Icons List

The installed icons container MUST apply `max-height` with `overflow-y: auto` so a large icon list does not push the Generate button below the viewport.

#### Scenario: 300+ installed icons

- GIVEN 300 icons are installed
- WHEN the installed icons section renders
- THEN the container MUST show a vertical scrollbar
- AND the Generate button MUST remain visible without additional scrolling

#### Scenario: Few installed icons (no scroll)

- GIVEN fewer than 10 icons are installed
- WHEN the list renders
- THEN no scrollbar SHALL appear
- AND all items SHALL be fully visible

### Requirement: Responsive Panel Layout

Core panels MUST be arranged in a single-column layout within a container that fits at 850px viewport height, with flexible spacing that adapts to content.

#### Scenario: All panels visible simultaneously

- GIVEN the window is at minimum size
- WHEN all panels render (REAPER path, source icon, crop + HSB, install, generate)
- THEN each panel SHALL be fully visible
- AND no panel SHALL overlap another
- AND the total height of all panels SHALL NOT exceed 850px
