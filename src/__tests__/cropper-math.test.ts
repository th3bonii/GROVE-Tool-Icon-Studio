import { describe, it, expect } from 'vitest';
import {
  MIN_CROP_SIZE,
  HIT_THRESHOLD,
  Corner,
  DragMode,
  hitTestCorner,
  insideRect,
  cornerCursor,
  clampRect,
  getCanvasCoords,
} from '../cropper-math';

// ── Constants ─────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('MIN_CROP_SIZE is 10', () => {
    expect(MIN_CROP_SIZE).toBe(10);
  });

  it('HIT_THRESHOLD is 10', () => {
    expect(HIT_THRESHOLD).toBe(10);
  });
});

// ── Types ─────────────────────────────────────────────────────────────────────

describe('types', () => {
  it('DragMode accepts all four modes', () => {
    const idle: DragMode = 'idle';
    const draw: DragMode = 'draw';
    const move: DragMode = 'move';
    const resize: DragMode = 'resize';
    expect(idle).toBe('idle');
    expect(draw).toBe('draw');
    expect(move).toBe('move');
    expect(resize).toBe('resize');
  });

  it('Corner accepts all four corners', () => {
    const tl: Corner = 'tl';
    const tr: Corner = 'tr';
    const bl: Corner = 'bl';
    const br: Corner = 'br';
    expect(tl).toBe('tl');
    expect(tr).toBe('tr');
    expect(bl).toBe('bl');
    expect(br).toBe('br');
  });
});

// ── hitTestCorner ─────────────────────────────────────────────────────────────

describe('hitTestCorner', () => {
  const crop = { x: 50, y: 50, size: 100 };

  it('returns "tl" at (50,50)', () => {
    expect(hitTestCorner(50, 50, crop)).toBe('tl');
  });

  it('returns "tr" at (150,50)', () => {
    expect(hitTestCorner(150, 50, crop)).toBe('tr');
  });

  it('returns "bl" at (50,150)', () => {
    expect(hitTestCorner(50, 150, crop)).toBe('bl');
  });

  it('returns "br" at (150,150)', () => {
    expect(hitTestCorner(150, 150, crop)).toBe('br');
  });

  it('returns null when 11px from tl corner (outside HIT_THRESHOLD)', () => {
    expect(hitTestCorner(61, 50, crop)).toBeNull();
  });

  it('returns null for point in center of crop', () => {
    expect(hitTestCorner(100, 100, crop)).toBeNull();
  });

  it('returns null for point well outside the crop', () => {
    expect(hitTestCorner(0, 0, crop)).toBeNull();
  });

  it('hit exactly at threshold boundary (10px away)', () => {
    // 10px away from tl corner → still within threshold
    expect(hitTestCorner(60, 50, crop)).toBe('tl');
  });
});

// ── insideRect ────────────────────────────────────────────────────────────────

describe('insideRect', () => {
  const crop = { x: 50, y: 50, size: 100 };

  it('returns true for point well inside the crop', () => {
    expect(insideRect(80, 80, crop)).toBe(true);
  });

  it('returns false for point in top-left margin (within 10px threshold)', () => {
    expect(insideRect(55, 55, crop)).toBe(false);
  });

  it('returns true for point exactly on the inner margin boundary', () => {
    // Margin = 10, so inner rect starts at (60,60)
    expect(insideRect(60, 60, crop)).toBe(true);
  });

  it('returns false for point outside left edge', () => {
    expect(insideRect(40, 80, crop)).toBe(false);
  });

  it('returns false for point outside top edge', () => {
    expect(insideRect(80, 40, crop)).toBe(false);
  });

  it('returns false for point outside right edge', () => {
    expect(insideRect(160, 80, crop)).toBe(false);
  });

  it('returns false for point outside bottom edge', () => {
    expect(insideRect(80, 160, crop)).toBe(false);
  });

  it('returns true at right inner margin boundary (140)', () => {
    expect(insideRect(140, 80, crop)).toBe(true);
  });

  it('returns true at bottom inner margin boundary (140)', () => {
    expect(insideRect(80, 140, crop)).toBe(true);
  });
});

// ── cornerCursor ──────────────────────────────────────────────────────────────

describe('cornerCursor', () => {
  it('tl → "nwse-resize"', () => {
    expect(cornerCursor('tl')).toBe('nwse-resize');
  });

  it('br → "nwse-resize"', () => {
    expect(cornerCursor('br')).toBe('nwse-resize');
  });

  it('tr → "nesw-resize"', () => {
    expect(cornerCursor('tr')).toBe('nesw-resize');
  });

  it('bl → "nesw-resize"', () => {
    expect(cornerCursor('bl')).toBe('nesw-resize');
  });
});

// ── clampRect ─────────────────────────────────────────────────────────────────

describe('clampRect', () => {
  it('leaves in-bounds values unchanged', () => {
    expect(clampRect(50, 50, 100, 200, 200)).toEqual({ x: 50, y: 50, size: 100 });
  });

  it('clamps negative x,y to 0', () => {
    expect(clampRect(-10, -10, 100, 200, 200)).toEqual({ x: 0, y: 0, size: 100 });
  });

  it('floors size smaller than MIN_CROP_SIZE', () => {
    expect(clampRect(50, 50, 3, 200, 200)).toEqual({ x: 50, y: 50, size: 10 });
  });

  it('clamps x to prevent overflow beyond canvas edge', () => {
    // x=150, size=100 → canvasW-s = 100 → x clamps to 100
    const result = clampRect(150, 50, 100, 200, 200);
    expect(result.x).toBe(100);
    expect(result.size).toBeLessThanOrEqual(100);
  });

  it('clamps y to prevent overflow beyond canvas edge', () => {
    const result = clampRect(50, 150, 100, 200, 200);
    expect(result.y).toBe(100);
    expect(result.size).toBeLessThanOrEqual(100);
  });

  it('shrinks size when clamped x/y leaves less room than size', () => {
    // With x=100, y=100, size=100 on canvas 200×200:
    // canvasW - cx = 100, canvasH - cy = 100
    expect(clampRect(150, 150, 100, 200, 200)).toEqual({ x: 100, y: 100, size: 100 });
  });

  it('handles zero size by flooring to MIN_CROP_SIZE', () => {
    expect(clampRect(50, 50, 0, 200, 200)).toEqual({ x: 50, y: 50, size: 10 });
  });

  it('handles size larger than canvas', () => {
    const result = clampRect(0, 0, 500, 200, 200);
    expect(result.size).toBe(200); // constrained by canvas
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

// ── getCanvasCoords ───────────────────────────────────────────────────────────

describe('getCanvasCoords', () => {
  function makeCanvas(
    width: number,
    height: number,
    rectLeft: number,
    rectTop: number,
    rectWidth: number,
    rectHeight: number,
  ) {
    return {
      width,
      height,
      getBoundingClientRect: () =>
        ({
          left: rectLeft,
          top: rectTop,
          width: rectWidth,
          height: rectHeight,
          right: rectLeft + rectWidth,
          bottom: rectTop + rectHeight,
          x: rectLeft,
          y: rectTop,
          toJSON: () => ({}),
        }) as DOMRect,
    };
  }

  it('converts 1:1 scale (CSS matches logical pixels)', () => {
    const canvas = makeCanvas(800, 600, 0, 0, 800, 600);
    expect(getCanvasCoords(100, 100, canvas)).toEqual({ x: 100, y: 100 });
  });

  it('converts 2× CSS scaling (CSS half logical)', () => {
    const canvas = makeCanvas(800, 600, 10, 10, 400, 300);
    // (210 - 10) * (800 / 400) = 200 * 2 = 400
    // (160 - 10) * (600 / 300) = 150 * 2 = 300
    expect(getCanvasCoords(210, 160, canvas)).toEqual({ x: 400, y: 300 });
  });

  it('handles edge coordinate (0,0) with non-zero rect offset', () => {
    const canvas = makeCanvas(800, 600, 50, 50, 400, 300);
    expect(getCanvasCoords(50, 50, canvas)).toEqual({ x: 0, y: 0 });
  });

  it('returns (0,0) when canvas is null', () => {
    expect(getCanvasCoords(100, 100, null)).toEqual({ x: 0, y: 0 });
  });
});
