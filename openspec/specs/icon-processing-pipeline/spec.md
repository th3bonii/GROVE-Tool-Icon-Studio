# icon-processing-pipeline Specification

## Purpose

Rust-based pixel-level image processing for the 3-state toolbar format.

## Requirements

### Requirement: 3-State Generation

The system MUST process an input image into a 3-state REAPER toolbar icon.

#### Scenario: 3-state icon generation

- GIVEN an input test image
- WHEN passed through the image processing pipeline
- THEN it MUST output an image with exactly three horizontally stacked states (normal, hovered, clicked)

### Requirement: Dimension Constraints

The generated 3-state icon MUST adhere to REAPER's toolbar dimensions and formatting rules.

#### Scenario: Dimension formatting

- GIVEN a valid input image of width W and height H
- WHEN processed
- THEN the output image dimensions MUST be width = 3 * W and height = H
- AND the states MUST be distributed evenly across the width

### Requirement: Pixel Accuracy

The image processing MUST strictly adhere to the transparency and color mapping requirements of REAPER toolbar icons.

#### Scenario: Alpha channel preservation

- GIVEN an input image with transparent pixels
- WHEN processed into the 3-state format
- THEN the transparency MUST be correctly preserved in all three states
