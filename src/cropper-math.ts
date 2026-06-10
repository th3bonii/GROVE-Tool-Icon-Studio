/** Minimum crop rectangle size in canvas pixels. */
export const MIN_CROP_SIZE = 10;

/** Distance threshold for corner handle hit detection in canvas pixels. */
export const HIT_THRESHOLD = 10;

/** Drag interaction mode for the crop rect. */
export type DragMode = 'idle' | 'draw' | 'move' | 'resize';

/** Corner of the crop rectangle used for resize handles. */
export type Corner = 'tl' | 'tr' | 'bl' | 'br';

/**
 * Get the corner at (px, py) if within HIT_THRESHOLD, or null.
 */
export function hitTestCorner(
  px: number, py: number,
  crop: { x: number; y: number; size: number },
): Corner | null {
  const { x, y, size } = crop;
  const corners: { corner: Corner; cx: number; cy: number }[] = [
    { corner: 'tl', cx: x, cy: y },
    { corner: 'tr', cx: x + size, cy: y },
    { corner: 'bl', cx: x, cy: y + size },
    { corner: 'br', cx: x + size, cy: y + size },
  ];
  for (const c of corners) {
    if (Math.abs(px - c.cx) <= HIT_THRESHOLD && Math.abs(py - c.cy) <= HIT_THRESHOLD) {
      return c.corner;
    }
  }
  return null;
}

/**
 * Check if (px, py) is inside the crop rect (excluding corner/margin zones).
 */
export function insideRect(
  px: number, py: number,
  crop: { x: number; y: number; size: number },
): boolean {
  const margin = HIT_THRESHOLD;
  return (
    px >= crop.x + margin && px <= crop.x + crop.size - margin &&
    py >= crop.y + margin && py <= crop.y + crop.size - margin
  );
}

/**
 * Map a corner to a CSS cursor name.
 */
export function cornerCursor(corner: Corner): string {
  switch (corner) {
    case 'tl': return 'nwse-resize';
    case 'br': return 'nwse-resize';
    case 'tr': return 'nesw-resize';
    case 'bl': return 'nesw-resize';
  }
}

/**
 * Clamp a crop rect to fit within canvas bounds.
 * Floors size to MIN_CROP_SIZE, clamps x/y to [0, canvasDimension - size],
 * then shrinks size if remaining space is insufficient.
 */
export function clampRect(
  x: number, y: number, size: number, canvasW: number, canvasH: number,
): { x: number; y: number; size: number } {
  const s = Math.max(MIN_CROP_SIZE, size);
  const cx = Math.max(0, Math.min(x, canvasW - s));
  const cy = Math.max(0, Math.min(y, canvasH - s));
  return { x: cx, y: cy, size: Math.min(s, canvasW - cx, canvasH - cy) };
}

/**
 * Convert client-space coordinates to canvas logical coordinates,
 * accounting for CSS scaling of the canvas element.
 *
 * Returns { x: 0, y: 0 } if canvas is null.
 */
export function getCanvasCoords(
  clientX: number,
  clientY: number,
  canvas: { getBoundingClientRect(): DOMRect; width: number; height: number } | null,
): { x: number; y: number } {
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}
