# Preview & Performance Specification

## Purpose

Define constraints for icon preview accuracy (1:1 pixel ratio), source image caching in Rust, and async processing to keep the UI responsive during crop and adjustment changes.

## Requirements

### Requirement: Actual-Size Preview

The preview MUST display icons at their exact REAPER toolbar pixel dimensions (1:1 ratio). A 2× zoom SHALL be the maximum display scale, with a visible size annotation at 1×.

#### Scenario: Preview at actual pixel size

- GIVEN a 30px icon is processed
- WHEN the state preview renders
- THEN each state MUST display at exactly 30×30px
- AND a "(actual size)" label SHALL appear beside the scale header

#### Scenario: 2× zoom preview

- GIVEN the user has enabled 2× zoom
- WHEN the preview renders
- THEN each state MUST display at 2× the actual pixel size
- AND the zoom factor SHALL be annotated

### Requirement: Source Image Caching

The Rust backend MUST cache the decoded source image keyed by source path to avoid re-reading from disk on every crop or adjustment change. The cache SHALL be invalidated when a new source is selected.

#### Scenario: Crop adjustment uses cached source

- GIVEN a source image was previously loaded
- WHEN the user adjusts the crop region
- THEN the backend SHALL use the cached source image
- AND the image MUST NOT be re-read from disk

#### Scenario: Cache invalidation on new source

- GIVEN a source image is cached
- WHEN the user selects a different source image
- THEN the cache SHALL be cleared
- AND the new source SHALL be read from disk

### Requirement: Async Processing

All image processing Tauri commands (preview, process, install) MUST run on async background threads. The UI SHALL remain responsive during processing.

#### Scenario: UI responsive during preview update

- GIVEN the user changes a crop or HSB slider
- WHEN processing starts
- THEN the UI MUST remain interactive
- AND a loading indicator SHALL be shown

#### Scenario: Main thread not blocked

- GIVEN processing is in progress
- WHEN the user interacts with the UI
- THEN the main thread MUST NOT be blocked at any point

### Requirement: Pre-resize per Scale

The source image MUST be resized to each target scale once per source load, and the resized result SHALL be reused across all state and variant iterations within that pipeline run.

#### Scenario: Single resize reused across states

- GIVEN source is loaded for 30px, 45px, and 60px scales
- WHEN the pipeline generates 6 states per scale
- THEN each scale SHALL be resized exactly once from the source
- AND the resized image SHALL be reused for all 6 states per scale
