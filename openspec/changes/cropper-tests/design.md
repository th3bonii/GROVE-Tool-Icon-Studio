# Design: Cropper Tests — Extract Pure Math + Add Unit & Integration Tests

## Technical Approach

Extract 5 pure functions + types/constants from `ImageCropper.tsx` into `cropper-math.ts` for direct unit testability. Build on the existing `ImageCropper.test.tsx` scaffold (155 lines, already has canvas/Image mocks) to add integration tests covering all 4 drag modes and keyboard navigation.

## Architecture Decisions

### Decision: Extract 5 functions, not 6

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extract 5 pure functions | `clampRect` is useCallback but semantically pure; `cornerCursor`/`insideRect`/`hitTestCorner`/`makeDragState` are already standalone; `getCanvasCoords`/`emitCrop` depend on DOM refs — stay inline | **Adopted** |
| Extract everything including `emitCrop` | Would require injecting mock refs — adds complexity with zero coverage gain | Rejected |

**Rationale**: 5 functions + `Corner`/`DragMode` types + constants gives full testability. No benefit to extracting DOM-dependent helpers.

### Decision: Build on existing test scaffold

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extend existing `ImageCropper.test.tsx` | Canvas mock, Image mock, bounding rect patterns already working — add new describe blocks | **Adopted** |
| Rewrite with pointer events | `fireEvent` gives precise `clientX`/`clientY` control; jsdom doesn't implement `pointer capture` reliably anyway | Rejected |

**Rationale**: Existing scaffold works. Adding new test blocks is lower risk than rewriting.

### Decision: Mock canvas getContext, don't render real pixels

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `vi.spyOn(HTMLCanvasElement.prototype, 'getContext')` | Simple mock covering all 8 methods `drawScene` calls — assert calls via `toHaveBeenCalledWith` | **Adopted** |
| `jest-canvas-mock` library | Extra dependency, may add maintenance burden | Rejected |

**Rationale**: The 8 methods used (`clearRect`, `drawImage`, `fillRect`, `strokeRect`, `fillText`, `beginPath` via `measureText`) are straightforward to mock. Only `measureText` needs a return value. Properties (`fillStyle`, `strokeStyle`, `lineWidth`, `font`, `textAlign`) are assignable without getter/setter traps.

## Data Flow

```
ImageCropper.tsx  ──imports──►  cropper-math.ts
    │                              │
    │                         (5 pure functions)
    │                              │
    ▼                              ▼
drawScene()                  cropper-math.test.ts
handleMouse*()               (table-driven unit tests)
handleKeyDown()
    │
    ▼
ImageCropper.test.tsx
(render → mock events → assert onCropChange)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/cropper-math.ts` | Create | 5 exported pure functions + `Corner`/`DragMode`/`CropRect`/`DragState` types + constants |
| `src/ImageCropper.tsx` | Modify | Import from `cropper-math.ts`, remove extracted function bodies |
| `src/__tests__/cropper-math.test.ts` | Create | Table-driven unit tests per function |
| `src/__tests__/ImageCropper.test.tsx` | Modify | Add draw/move/resize/kbd describe blocks (keeping existing scaffold) |

## Interfaces / Contracts

```typescript
// cropper-math.ts
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export type DragMode = 'idle' | 'draw' | 'move' | 'resize';
export interface CropRect { x: number; y: number; size: number; }
export interface DragState {
  mode: DragMode;
  corner: Corner | null;
  startX: number; startY: number;
  origX: number; origY: number; origSize: number;
}

export const MIN_CROP_SIZE = 10;
export const HANDLE_SIZE = 8;
export const HIT_THRESHOLD = 10;

export function makeDragState(): DragState;
export function hitTestCorner(px: number, py: number, crop: CropRect): Corner | null;
export function insideRect(px: number, py: number, crop: CropRect): boolean;
export function cornerCursor(corner: Corner): string;
export function clampRect(x: number, y: number, size: number, canvasW: number, canvasH: number): CropRect;
```

## Testing Strategy

| Layer | Focus | Approach |
|-------|-------|----------|
| Unit | `hitTestCorner` | Table: each corner hit, center miss, outside miss |
| Unit | `insideRect` | Table: inside, outside, edge near `HIT_THRESHOLD` margin |
| Unit | `cornerCursor` | Table: 4 corners → cursor string |
| Unit | `clampRect` | Table: in-bounds, clamped at 0, clamped at edge-w, min size, shrink-to-fit |
| Unit | `makeDragState` | Single assert: `mode === 'idle'` |
| Integration | Draw drag | `mousedown` outside crop → `mousemove` → `mouseup` → new rect emitted |
| Integration | Move drag | `mousedown` inside → `mousemove` → translated rect |
| Integration | Resize (×4 corners) | `mousedown` on each corner → `mousemove` → resized rect |
| Integration | Arrow keys | `keydown` ArrowUp/Down/Left/Right → moved rect |
| Integration | Shift+arrow | `shiftKey + ArrowX` → 10px step |

### Mock Strategy Summary

- **Canvas**: `vi.spyOn(HTMLCanvasElement.prototype, 'getContext')` → object with 8 mocked methods + assignable properties
- **Image**: `vi.stubGlobal('Image', class MockImage)` with captured `onload`, `naturalWidth=200`, `naturalHeight=150`
- **getBoundingClientRect**: `vi.spyOn(canvas, 'getBoundingClientRect')` → `DOMRect` matching canvas w/h
- **container.clientWidth**: `Object.defineProperty(div, 'clientWidth', { value: 400 })` — needed by sizing effect

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas mock misses a method `drawScene` calls | Test crash | Start with the existing mock (proven working) and add `vi.fn()` stubs for any new calls discovered during extraction |
| getBoundingClientRect values diverge from actual canvas layout | Wrong coord math | Keep `getBoundingClientRect` return values === `canvas.width`/`canvas.height` to ensure scale factor = 1 |
| Image mock doesn't fire onload after imageSrc changes | No crop emitted | Test only single `imageSrc` per mount — change-once scenario can be a separate test |
| Drag test flakiness from event order | Non-deterministic | Use `act()` wrapping around each event dispatch; fire in strict `down → move → up` sequence per test |

## Migration / Rollout

No migration required. `ImageCropper.tsx` loses 5 function bodies + type definitions but behaves identically. New tests run alongside existing.

## Open Questions

- [ ] Should `clampRect` guard against `canvasW - cx` dropping below `MIN_CROP_SIZE` after clamping x/y? Current code cascades `Math.min(s, canvasW - cx, canvasH - cy)` — if the remaining space is < 10px, the crop becomes unusable. This is pre-existing behavior, not introduced by extraction — leave as-is.
