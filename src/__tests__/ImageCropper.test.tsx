import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import ImageCropper from '../ImageCropper';
import type { CropArea } from '../api';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function createMockContext() {
  const ctx: Record<string, unknown> = {
    canvas: { width: 0, height: 0 } as HTMLCanvasElement,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
  };
  // Settable canvas context properties (plain object assignments work on mock)
  return ctx as unknown as CanvasRenderingContext2D;
}

// ── Suit ──────────────────────────────────────────────────────────────────────

describe('ImageCropper', () => {
  let onCropChange: Mock<(crop: CropArea | null) => void>;
  let imageOnloadFn: () => void;

  const IMG_W = 200;
  const IMG_H = 150;
  const CONTAINER_W = 400;
  // Canvas is sized by the component: aspect = 150/200 = 0.75 → 400×300
  const CANVAS_W = 400;
  const CANVAS_H = 300;

  beforeEach(() => {
    onCropChange = vi.fn<(crop: CropArea | null) => void>();

    // Mock canvas 2D context
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      createMockContext(),
    );

    // Mock Image constructor — capture onload for manual trigger
    let mockImageInstance: {
      onload: (() => void) | null;
      src: string;
      naturalWidth: number;
      naturalHeight: number;
    } | null = null;

    class MockImage {
      onload: (() => void) | null = null;
      _src = '';
      naturalWidth = IMG_W;
      naturalHeight = IMG_H;

      set src(val: string) {
        this._src = val;
      }
      get src(): string {
        return this._src;
      }

      constructor() {
        mockImageInstance = this;
      }
    }

    imageOnloadFn = () => mockImageInstance?.onload?.();
    vi.stubGlobal('Image', MockImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── Setup helper ────────────────────────────────────────────────────────────

  function setup() {
    const result = render(
      <div style={{ width: `${CONTAINER_W}px` }}>
        <ImageCropper imageSrc="test.png" onCropChange={onCropChange} />
      </div>,
    );

    // Set container clientWidth for canvas sizing
    const cropperDiv = result.container.firstChild!
      .firstChild as HTMLElement;
    Object.defineProperty(cropperDiv, 'clientWidth', {
      value: CONTAINER_W,
      configurable: true,
    });

    // Trigger image load manually
    act(() => {
      imageOnloadFn();
    });

    // Set up canvas for coordinate conversion (1:1 CSS scale)
    const canvas = result.container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', {
      value: CANVAS_W,
      writable: true,
    });
    Object.defineProperty(canvas, 'height', {
      value: CANVAS_H,
      writable: true,
    });
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: CANVAS_W,
      height: CANVAS_H,
      right: CANVAS_W,
      bottom: CANVAS_H,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    return { ...result, canvas, cropperDiv };
  }

  // ── Basic tests ─────────────────────────────────────────────────────────────

  it('shows loading state before image loads', () => {
    const { container } = render(
      <div style={{ width: `${CONTAINER_W}px` }}>
        <ImageCropper imageSrc="test.png" onCropChange={onCropChange} />
      </div>,
    );

    expect(screen.getByText('Loading image…')).toBeInTheDocument();

    // Canvas is hidden initially (use container.querySelector since
    // getByRole ignores hidden elements by default)
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas!.style.display).toBe('none');
  });

  it('renders canvas with tabIndex and aria-label', () => {
    const { canvas } = setup();
    expect(canvas).toBeInTheDocument();
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.getAttribute('aria-label')).toBe(
      'Crop area. Use arrow keys to adjust.',
    );
  });

  it('canvas is visible after image loads', () => {
    const { canvas } = setup();
    expect(canvas.style.display).toBe('block');
  });

  // ── Default crop ────────────────────────────────────────────────────────────

  it('emits a default centered square crop after image loads', () => {
    setup();

    // Image 200×150 → min = 150 → centered 150×150
    // Canvas coords: scaleX = 400/200 = 2
    //   rawCropSize = 150, rawCropX = 25, rawCropY = 0
    //   cCropX=Math.round(25*2)=50, cCropY=0, cCropSize=Math.round(150*2)=300
    // Image coords: scaleX = 200/400 = 0.5
    //   x=Math.round(50*0.5)=25, y=0, w=Math.round(300*0.5)=150, h=150
    expect(onCropChange).toHaveBeenCalledWith({
      x: 25,
      y: 0,
      width: 150,
      height: 150,
    } satisfies CropArea);
  });

  // ── Phase 4, Task 4.1: Draw mode ────────────────────────────────────────────

  it('4.1 draw mode: mousedown outside crop → mousemove → mouseup emits new rect via onCropChange', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Default crop: canvas { x: 50, y: 0, size: 300 }
    // Click at (0, 0) which is outside crop (crop starts at x=50)
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(canvas, { clientX: 50, clientY: 50 });

    // dx=50, dy=50, size=50
    // Canvas crop: { x: 0, y: 0, size: 50 }
    // Image coords: scale=0.5 → { x: 0, y: 0, width: 25, height: 25 }
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 25,
      height: 25,
    } satisfies CropArea);

    // After mouseup, mode returns to idle — another mousedown should restart
    onCropChange.mockClear();
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas, { clientX: 100, clientY: 100 });
    // A click without move creates a MIN_CROP_SIZE rect at that point
    expect(onCropChange).toHaveBeenCalledOnce();
  });

  // ── Phase 4, Task 4.2: Move mode ────────────────────────────────────────────

  it('4.2 move mode: mousedown inside crop → mousemove → translated rect, size unchanged', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Default crop: canvas { x: 50, y: 0, size: 300 }
    // insideRect inner bounds: x∈[60, 340], y∈[10, 290]
    // Click at (200, 150) (inside), move to (250, 150) (50px right)
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 150 });
    fireEvent.mouseMove(canvas, { clientX: 250, clientY: 150 });
    fireEvent.mouseUp(canvas, { clientX: 250, clientY: 150 });

    // dx=50, dy=0
    // Canvas: x=50+50=100, y=0+0=0, size=300
    // clampRect(100, 0, 300, 400, 300) → size stays 300 (canvasW-x=300 ≥ 300)
    // Image coords: scale=0.5 → { x: 50, y: 0, width: 150, height: 150 }
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 50,
      y: 0,
      width: 150,
      height: 150,
    } satisfies CropArea);
  });

  it('move mode: size is preserved through translation', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Drag crop to the right edge — size should be preserved (not grow wider)
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 150 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 150 });
    fireEvent.mouseUp(canvas, { clientX: 300, clientY: 150 });

    const crop = onCropChange.mock.calls[0][0] as CropArea;
    expect(crop.width).toBe(150);
    expect(crop.height).toBe(150);
  });

  // ── Phase 4, Task 4.3: Resize mode — br corner ──────────────────────────────

  it('4.3 resize mode: mousedown on br corner → mousemove → resized rect, onCropChange fires', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Default crop: canvas { x: 50, y: 0, size: 300 }
    // br corner at (50+300, 0+300) = (350, 300)
    // Click on br corner, then move inside
    fireEvent.mouseDown(canvas, { clientX: 350, clientY: 300 });
    fireEvent.mouseMove(canvas, { clientX: 330, clientY: 280 });
    fireEvent.mouseUp(canvas, { clientX: 330, clientY: 280 });

    // Opposite (tl) at (50, 0)
    // size = max(|330-50|=280, |280-0|=280, 10) = 280
    // For br: x=50, y=0
    // clampRect(50, 0, 280, 400, 300) = { x: 50, y: 0, size: 280 }
    //   min(280, 400-50=350, 300-0=300) = 280
    // Image coords: scale=0.5
    //   x=Math.round(50*0.5)=25, y=0
    //   w=Math.round(280*0.5)=140, h=140
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 25,
      y: 0,
      width: 140,
      height: 140,
    } satisfies CropArea);
  });

  it('resize mode: br corner expands when dragging outward', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Default crop at (50, 0, 300). Canvas is 400×300.
    // br corner at (350, 300). Drag right-down past canvas edge.
    // Opposite (tl) at (50, 0)
    fireEvent.mouseDown(canvas, { clientX: 350, clientY: 300 });
    fireEvent.mouseMove(canvas, { clientX: 400, clientY: 350 });
    fireEvent.mouseUp(canvas, { clientX: 400, clientY: 350 });

    // size = max(|400-50|=350, |350-0|=350, 10) = 350
    // For br: x=50, y=0
    // clampRect(50, 0, 350, 400, 300)
    //   s=350, cx=50, cy=0
    //   min(350, 400-50=350, 300-0=300) = 300
    //   → { x: 50, y: 0, size: 300 } — clamped to canvas height
    // So expanding past canvas edge clamps to max possible size
    const crop = onCropChange.mock.calls[0][0] as CropArea;
    // In image coords: 300 * 0.5 = 150
    expect(crop.width).toBe(150);
    expect(crop.height).toBe(150);
  });

  // ── Resize mode: all 4 corners ──────────────────────────────────────────────

  it('resize from tl corner: opposite br stays fixed', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Default crop: canvas { x: 50, y: 0, size: 300 }
    // tl corner at (50, 0), opposite br at (350, 300)
    // Drag tl to (70, 20) — expanding inward
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 70, clientY: 20 });
    fireEvent.mouseUp(canvas, { clientX: 70, clientY: 20 });

    // For 'tl': opposite = br = (350, 300)
    // size = max(|70-350|=280, |20-300|=280, 10) = 280
    // For tl: x = opposite.x - size = 350 - 280 = 70
    //         y = opposite.y - size = 300 - 280 = 20
    // clampRect(70, 20, 280, 400, 300)
    //   min(280, 400-70=330, 300-20=280) = 280
    // Image coords: scale=0.5
    //   x=Math.round(70*0.5)=35, y=Math.round(20*0.5)=10
    //   w=Math.round(280*0.5)=140, h=140
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 35,
      y: 10,
      width: 140,
      height: 140,
    } satisfies CropArea);
  });

  it('resize from tr corner: opposite bl stays fixed', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // tr corner at (350, 0), opposite bl at (50, 300)
    // Drag tr to (330, 20)
    fireEvent.mouseDown(canvas, { clientX: 350, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 330, clientY: 20 });
    fireEvent.mouseUp(canvas, { clientX: 330, clientY: 20 });

    // For 'tr': opposite = bl = (50, 300)
    // size = max(|330-50|=280, |20-300|=280, 10) = 280
    // For tr: x = opposite.x = 50
    //         y = opposite.y - size = 300 - 280 = 20
    // clampRect(50, 20, 280, 400, 300) → { x: 50, y: 20, size: 280 }
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 25,
      y: 10,
      width: 140,
      height: 140,
    } satisfies CropArea);
  });

  it('resize from bl corner: opposite tr stays fixed', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // bl corner at (50, 300), opposite tr at (350, 0)
    // Drag bl to (70, 280)
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 300 });
    fireEvent.mouseMove(canvas, { clientX: 70, clientY: 280 });
    fireEvent.mouseUp(canvas, { clientX: 70, clientY: 280 });

    // For 'bl': opposite = tr = (350, 0)
    // size = max(|70-350|=280, |280-0|=280, 10) = 280
    // For bl: x = opposite.x - size = 350 - 280 = 70
    //         y = opposite.y = 0
    // clampRect(70, 0, 280, 400, 300) → { x: 70, y: 0, size: 280 }
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 35,
      y: 0,
      width: 140,
      height: 140,
    } satisfies CropArea);
  });

  // ── Phase 4, Task 4.4: Keyboard navigation (1px) ────────────────────────────

  it('4.4 keyboard: ArrowRight moves crop right by 1px canvas coords', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    canvas.focus();
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });

    // Canvas x: 50 + 1 = 51
    // Image x: Math.round(51 * 0.5) = Math.round(25.5) = 26
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 26,
      y: 0,
      width: 150,
      height: 150,
    } satisfies CropArea);
  });

  it('4.4 keyboard: ArrowDown clamps when crop fills canvas height (y=0)', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Default crop size=300 fills canvas height=300, so y can't increase
    canvas.focus();
    fireEvent.keyDown(canvas, { key: 'ArrowDown' });

    // Canvas y: 0 + 1 = 1 → clampRect: min(1, 300-300=0) → y = 0
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 25,
      y: 0,
      width: 150,
      height: 150,
    } satisfies CropArea);
  });

  it('4.4 keyboard: ArrowUp clamps at canvas top edge (y=0)', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Default crop is at y=0, so ArrowUp should clamp
    canvas.focus();
    fireEvent.keyDown(canvas, { key: 'ArrowUp' });

    // Canvas y: 0 - 1 = -1 → clampRect → y = 0
    // Image y: Math.round(0 * 0.5) = 0
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 25,
      y: 0,
      width: 150,
      height: 150,
    } satisfies CropArea);
  });

  it('4.4 keyboard: ArrowLeft moves crop left by 1px canvas coords', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    canvas.focus();
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' });

    // Canvas x: 50 - 1 = 49
    // Image x: Math.round(49 * 0.5) = Math.round(24.5) = 25
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 25,
      y: 0,
      width: 150,
      height: 150,
    } satisfies CropArea);
  });

  it('4.4 keyboard: ArrowLeft clamps at canvas left edge (x=0) after enough presses', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Press ArrowLeft repeatedly until clamped
    for (let i = 0; i < 60; i++) {
      canvas.focus();
      fireEvent.keyDown(canvas, { key: 'ArrowLeft' });
    }

    // The last call should have x clamped at 0 (in canvas coords)
    const lastCall = onCropChange.mock
      .lastCall as unknown as [CropArea];
    // Canvas x at 0 → image x = 0
    expect(lastCall[0].x).toBe(0);
  });

  // ── Phase 4, Task 4.5: Shift+Arrow (10px) ───────────────────────────────────

  it('4.5 keyboard: Shift+ArrowRight moves crop right by 10px canvas coords', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    canvas.focus();
    fireEvent.keyDown(canvas, { key: 'ArrowRight', shiftKey: true });

    // Canvas x: 50 + 10 = 60
    // Image x: Math.round(60 * 0.5) = Math.round(30) = 30
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 30,
      y: 0,
      width: 150,
      height: 150,
    } satisfies CropArea);
  });

  it('4.5 keyboard: Shift+ArrowDown clamps when crop fills canvas height', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Default crop size=300 fills canvas height=300, so y can't increase
    canvas.focus();
    fireEvent.keyDown(canvas, { key: 'ArrowDown', shiftKey: true });

    // Canvas y: 0 + 10 = 10 → clampRect: min(10, 300-300=0) → y = 0
    expect(onCropChange).toHaveBeenCalledOnce();
    expect(onCropChange).toHaveBeenCalledWith({
      x: 25,
      y: 0,
      width: 150,
      height: 150,
    } satisfies CropArea);
  });

  it('4.5 keyboard: Shift+ArrowUp at canvas top clamps y to 0', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Default crop at y=0, Shift+ArrowUp should clamp
    canvas.focus();
    fireEvent.keyDown(canvas, { key: 'ArrowUp', shiftKey: true });

    expect(onCropChange).toHaveBeenCalledOnce();
    const crop = onCropChange.mock.calls[0][0] as CropArea;
    expect(crop.y).toBe(0);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it('component unmount does not throw', () => {
    const { unmount } = setup();
    expect(() => unmount()).not.toThrow();
  });

  it('loading state disappears and canvas appears after image loads', () => {
    const { canvas } = setup();
    expect(screen.queryByText('Loading image…')).not.toBeInTheDocument();
    expect(canvas.style.display).toBe('block');
  });

  it('handles null/empty imageSrc without crashing', () => {
    const onCropChange2 = vi.fn();
    render(
      <div style={{ width: '400px' }}>
        <ImageCropper imageSrc="" onCropChange={onCropChange2} />
      </div>,
    );

    // Image with empty src still fires onload in our mock, so loading state
    // transitions. The component should not crash in any case.
    expect(screen.getByText('Loading image…')).toBeInTheDocument();
  });

  it('handleKeyDown does nothing when no crop is set', () => {
    const onCropChange2 = vi.fn();
    const { container } = render(
      <div style={{ width: '400px' }}>
        <ImageCropper imageSrc="test.png" onCropChange={onCropChange2} />
      </div>,
    );

    // Without triggering image load, there's no crop ref
    const canvas = container.querySelector('canvas')!;
    canvas.focus();
    expect(() => {
      fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    }).not.toThrow();
    // No crop change should be emitted
    expect(onCropChange2).not.toHaveBeenCalled();
  });

  it('mouseDown does nothing when no crop is set', () => {
    const onCropChange2 = vi.fn();
    const { container } = render(
      <div style={{ width: '400px' }}>
        <ImageCropper imageSrc="test.png" onCropChange={onCropChange2} />
      </div>,
    );

    const canvas = container.querySelector('canvas')!;
    expect(() => {
      fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
      fireEvent.mouseUp(canvas, { clientX: 50, clientY: 50 });
    }).not.toThrow();
    // No crop change should be emitted
    expect(onCropChange2).not.toHaveBeenCalled();
  });

  it('mouseleave cancels active drag like mouseup', () => {
    const { canvas } = setup();
    onCropChange.mockClear();

    // Start a draw drag
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    // Mouse leaves the canvas — should trigger handleMouseUp
    fireEvent.mouseLeave(canvas);

    // The drag should be finalized
    expect(onCropChange).toHaveBeenCalledOnce();
    const crop = onCropChange.mock.calls[0][0] as CropArea;
    expect(crop.width).toBeGreaterThan(0);
    expect(crop.height).toBeGreaterThan(0);
  });
});
