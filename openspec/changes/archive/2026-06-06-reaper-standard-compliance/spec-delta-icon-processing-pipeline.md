# Delta for icon-processing-pipeline

## MODIFIED Requirements

### Requirement: 6-State Generation (was 3-State Generation)

The system MUST process an input image into a 6-state REAPER toolbar icon covering OFF/ON × Normal/Hover/Active states using per-state HSB deltas.
(Previously: 3-state generation using additive RGB brightness)

#### Scenario: 6-state icon generation

- GIVEN an input test image and 6 HSB adjustment configurations
- WHEN passed through the image processing pipeline
- THEN it MUST output an image with exactly six horizontally stacked states (OFF Normal, OFF Hover, OFF Active, ON Normal, ON Hover, ON Active)

#### Scenario: State ordering matches REAPER convention

- GIVEN a generated 6-state icon
- WHEN the states are laid out horizontally
- THEN the order MUST be: OFF Normal, OFF Hover, OFF Active, ON Normal, ON Hover, ON Active

### Requirement: Dimension Constraints (Updated)

The generated icon MUST adhere to REAPER's toolbar dimensions. Width MUST be 6 × state_width and height = state_height.
(Previously: width = 3 × W)

#### Scenario: 6-state dimension formatting

- GIVEN a valid input image of width W and height H
- WHEN processed
- THEN the output image dimensions MUST be width = 6 × W and height = H
- AND the 6 states MUST be distributed evenly across the width

### Requirement: HSB Transformation (was Pixel Accuracy)

The image processing MUST apply per-state HSB delta adjustments instead of additive RGB brightness. The alpha channel MUST be preserved unchanged.
(Previously: additive RGB brightness adjustments)

#### Scenario: HSB delta applied per pixel

- GIVEN an input pixel with RGB values
- WHEN computing any state
- THEN the pixel MUST be converted to HSB, adjusted by the state's configured deltas, and converted back to RGB
- AND the alpha channel MUST be preserved unchanged

#### Scenario: Alpha channel preservation

- GIVEN an input image with transparent pixels
- WHEN processed into the 6-state format
- THEN the transparency MUST be correctly preserved in all six states

## ADDED Requirements

### Requirement: Configurable Padding

The pipeline MUST support an optional padding parameter (0-4px, default 2px) that insets the icon within the canvas.

#### Scenario: Padding inset logic

- GIVEN padding is set to 2px on a 30px canvas
- WHEN the pipeline processes the icon
- THEN the icon MUST be scaled to 26×26px and centered
- AND the surrounding 2px border MUST be transparent

#### Scenario: Padding at maximum value

- GIVEN padding is set to 4px on a 30px canvas
- WHEN the pipeline processes the icon
- THEN the icon MUST be scaled to 22×22px and centered

### Requirement: Multi-Scale Generation

The pipeline MUST generate icon sets at 100% (30px), 150% (45px), and 200% (60px) per state. The generate_icon_set() function MUST return Vec<ProcessingOutput>.

#### Scenario: Three scales produced per icon

- GIVEN a source crop region
- WHEN generate_icon_set() is called
- THEN it MUST produce outputs at 30px, 45px, and 60px per state
- AND each scale MUST contain all 6 states

### Requirement: Toggle ON/OFF Output

When is_toggle is true, the pipeline MUST run twice per scale — once with OFF adjustments, once with ON adjustments — producing {name}.png and {name}_on.png.

#### Scenario: Toggle mode dual file output

- GIVEN is_toggle=true and name "myicon"
- WHEN processing completes
- THEN OFF variant MUST be written as myicon.png
- AND ON variant MUST be written as myicon_on.png

#### Scenario: Non-toggle single file output

- GIVEN is_toggle=false
- WHEN processing completes
- THEN only OFF variant MUST be generated
- AND no _on.png file MUST exist for any scale
