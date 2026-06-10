# Tasks: Cropper Tests — Extract Pure Math + Add Unit & Integration Tests

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~545 (470 additions, 75 deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: extract + import refactor → PR 2: unit + integration tests |
| Delivery strategy | ask-on-risk (resolved: stacked-to-main, PR 1/2) |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes (resolved: stacked-to-main PR 1/2)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Extract `cropper-math.ts` + update `ImageCropper.tsx` imports | PR 1 | base=main; existing ImageCropper tests continue passing |
| 2 | Unit tests (`cropper-math.test.ts`) + integration tests (`ImageCropper.test.tsx` extra blocks) | PR 2 | base=main; requires cropper-math.ts to exist (merge PR 1 first) |

## Phase 1: Extract Pure Functions to src/cropper-math.ts

- [x] 1.1 Create `src/cropper-math.ts` — export `Corner`, `DragMode`, types + `MIN_CROP_SIZE`, `HIT_THRESHOLD` constants
- [x] 1.2 Add `hitTestCorner(px, py, crop): Corner | null` — checks 4 corners within HIT_THRESHOLD
- [x] 1.3 Add `insideRect(px, py, crop): boolean` — true inside crop excluding HIT_THRESHOLD margin
- [x] 1.4 Add `cornerCursor(corner): string` — tl/br→nwse-resize, tr/bl→nesw-resize
- [x] 1.5 Add `clampRect(x, y, size, canvasW, canvasH)` — clamp to bounds, floor at MIN_CROP_SIZE
- [x] 1.6 Add `getCanvasCoords(clientX, clientY, canvas): {x, y}` — client→canvas with CSS scale correction

## Phase 2: Update ImageCropper.tsx Imports

- [x] 2.1 Add import `{ Corner, DragMode, MIN_CROP_SIZE, hitTestCorner, insideRect, cornerCursor, clampRect, getCanvasCoords } from './cropper-math'`
- [x] 2.2 Remove inline function bodies, `Corner`/`DragMode` types, `MIN_CROP_SIZE`/`HIT_THRESHOLD` declarations
- [x] 2.3 Update `getCanvasCoords` call sites (`handleMouseDown`, `handleMouseMove`) to pass `canvasRef.current` as third argument
- [x] 2.4 Keep: `DragState` interface, `makeDragState()`, `OVERLAY_ALPHA`, `BORDER_COLOR`, `HANDLE_FILL`, `HANDLE_STROKE`, `STROKE_WIDTH`, `LABEL_FONT`, `HANDLE_SIZE`, `emitCrop` (ref-dependent)

## Phase 3: Unit Tests — src/__tests__/cropper-math.test.ts

- [x] 3.1 `hitTestCorner` table: each corner hit (tl/tr/bl/br), inside miss, outside null (TDD approval tests)
- [x] 3.2 `insideRect` table: inside, outside (top/left/right/bottom), on margin boundary (TDD approval tests)
- [x] 3.3 `cornerCursor` table: all 4 corners → cursor strings (TDD approval tests)
- [x] 3.4 `clampRect` table: in-bounds, clamped at 0, clamped at edge-w, zero-size→MIN_CROP_SIZE, shrink-to-fit (TDD approval tests)
- [x] 3.5 `getCanvasCoords` table: mock canvas 1:1, 2× CSS scale, edge coordinates, null canvas guard (TDD approval tests)

## Phase 4: Integration Tests — src/__tests__/ImageCropper.test.tsx

- [x] 4.1 Draw mode: mousedown outside crop → mousemove → mouseup → new rect via onCropChange
- [x] 4.2 Move mode: mousedown inside crop (excludes corners) → mousemove → translated rect, size unchanged
- [x] 4.3 Resize mode: mousedown on br corner → mousemove → resized rect 1:1 from tl, onCropChange fires
- [x] 4.4 Keyboard: ArrowUp/Down/Left/Right nudge crop by 1px, clamp at canvas edge
- [x] 4.5 Shift+arrow: ArrowUp with shiftKey → 10px step, clamp at canvas top
