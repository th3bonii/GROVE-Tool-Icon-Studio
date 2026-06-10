# Cropper Specification

## Purpose

Define the contract for ImageCropper's extracted pure math module, its test coverage, and the component refactor to import from the new module.

## Requirements

### Requirement: Pure Math Functions Extraction

The system MUST export six pure functions from `src/cropper-math.ts`:

| Function | Inputs | Returns | Contract |
|---|---|---|---|
| `hitTestCorner(px,py,crop)` | px,py, crop:{x,y,size} | Corner\|null | Corner within HIT_THRESHOLD=10px, else null |
| `insideRect(px,py,crop)` | px,py, crop:{x,y,size} | boolean | True inside crop excluding 10px margin |
| `cornerCursor(corner)` | corner:Corner | string | tl/br→"nwse-resize", tr/bl→"nesw-resize" |
| `clampRect(x,y,s,w,h)` | x,y,s,w,h | {x,y,size} | Clamps to canvas, floor MIN_CROP_SIZE=10 |
| `getCanvasCoords(cx,cy,cnv)` | cx,cy, canvas | {x,y} | Client→canvas with CSS scale correction |
| `emitCrop(crop,img,cnv)` | crop, img, canvas | CropArea | Scales canvas→image-native, round() |

#### Scenario: hitTestCorner at exact corner

- GIVEN crop {x:50, y:50, size:100}
- WHEN hitTestCorner(50, 50, crop)
- THEN returns 'tl'

#### Scenario: hitTestCorner returns null outside threshold

- GIVEN same crop
- WHEN hitTestCorner(61, 50, crop) — 11px from tl
- THEN returns null

#### Scenario: clampRect clamps and floors

- GIVEN canvas 200×200
- WHEN clampRect(-10, -10, 100, 200, 200)
- THEN returns {x:0, y:0, size:100}
- WHEN clampRect(50, 50, 3, 200, 200)
- THEN size floors to 10
- WHEN clampRect(150, 150, 100, 200, 200)
- THEN size clamps to 50 (canvasW - cx)

#### Scenario: insideRect excludes margin

- GIVEN crop {x:50, y:50, size:100}
- WHEN insideRect(55, 55, crop)
- THEN true
- WHEN insideRect(52, 52, crop)
- THEN false (within corner margin)

#### Scenario: getCanvasCoords CSS scaling

- GIVEN canvas logical 800×600, CSS 400×300, rect (10,10)
- WHEN getCanvasCoords(210, 160, canvas)
- THEN returns {x:400, y:300} (2× scale)

#### Scenario: emitCrop to natural dimensions

- GIVEN canvas 800×600, image natural 1600×1200
- WHEN emitCrop({x:100, y:100, size:200}, img, canvas)
- THEN returns {x:200, y:200, width:400, height:400}

### Requirement: Unit Test Coverage

The system MUST provide ≥90% line coverage for `src/cropper-math.ts` via `src/__tests__/cropper-math.test.ts`.

#### Scenario: Each function covered with happy path and edge cases

- GIVEN the cropper-math module
- WHEN each exported function is called with typical valid inputs AND boundary inputs
- THEN it returns expected results without throwing

### Requirement: Integration — Drag Mode Transitions

The system MUST test all four drag mode transitions via `src/__tests__/ImageCropper.test.tsx` using @testing-library/react with pointer events.

#### Scenario: Idle→Draw→Idle

- GIVEN rendered ImageCropper with loaded image, no existing crop
- WHEN user presses mouse on empty area and drags diagonally
- THEN new square crop rect appears
- WHEN user releases mouse
- THEN mode returns to idle and onCropChange fires

#### Scenario: Idle→Move→Idle

- GIVEN rendered ImageCropper with existing crop
- WHEN user presses inside crop (excludes corners) and drags
- THEN crop rect translates with pointer
- WHEN user releases
- THEN onCropChange fires, size unchanged

#### Scenario: Idle→Resize→Idle

- GIVEN rendered ImageCropper with existing crop
- WHEN user presses on br corner and drags diagonally
- THEN crop resizes 1:1 from tl corner
- WHEN user releases
- THEN onCropChange fires with new size

#### Scenario: Keyboard arrow keys nudge

- GIVEN rendered ImageCropper with existing crop
- WHEN ArrowUp pressed
- THEN crop y decreases by 1
- WHEN Shift+ArrowUp pressed
- THEN crop y decreases by 10
- WHEN crop at canvas top edge and ArrowUp pressed
- THEN crop y clamped to 0

### Requirement: ImageCropper Import Refactor

The system MUST modify `src/ImageCropper.tsx` to import the six functions from `./cropper-math` instead of defining them inline.

#### Scenario: Inline functions extracted, imports added

- GIVEN current ImageCropper.tsx with six inline functions
- WHEN they move to cropper-math.ts
- THEN ImageCropper imports them from './cropper-math'
- AND rendering, drawing, and drag handling remain identical
