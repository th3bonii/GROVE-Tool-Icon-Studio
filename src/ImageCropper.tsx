import { useRef, useState, useEffect, useCallback } from 'react';
import type { CropArea } from './api';
import { MIN_CROP_SIZE, Corner, DragMode, hitTestCorner, insideRect, cornerCursor, clampRect, getCanvasCoords } from './cropper-math';

interface ImageCropperProps {
  imageSrc: string;
  onCropChange: (crop: CropArea | null) => void;
}

const HANDLE_SIZE = 8;
const OVERLAY_ALPHA = 'rgba(0, 0, 0, 0.5)';
const BORDER_COLOR = '#fff';
const HANDLE_FILL = '#fff';
const HANDLE_STROKE = '#333';
const STROKE_WIDTH = 2;
const LABEL_FONT = '14px sans-serif';

interface DragState {
  mode: DragMode;
  /** Corner being dragged in resize mode */
  corner: Corner | null;
  /** Mouse start position in canvas pixels */
  startX: number;
  startY: number;
  /** Crop rect at the start of the drag */
  origX: number;
  origY: number;
  origSize: number;
}

function makeDragState(): DragState {
  return { mode: 'idle', corner: null, startX: 0, startY: 0, origX: 0, origY: 0, origSize: 0 };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ImageCropper({ imageSrc, onCropChange }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCropChangeRef = useRef(onCropChange);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState>(makeDragState());
  const currentCropRef = useRef<{ x: number; y: number; size: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [cursor, setCursor] = useState('crosshair');

  useEffect(() => {
    onCropChangeRef.current = onCropChange;
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const emitCrop = useCallback((canvasCrop: { x: number; y: number; size: number }) => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;
    onCropChangeRef.current({
      x: Math.round(canvasCrop.x * scaleX),
      y: Math.round(canvasCrop.y * scaleY),
      width: Math.round(canvasCrop.size * scaleX),
      height: Math.round(canvasCrop.size * scaleY),
    });
  }, []);

  // ── Drawing ─────────────────────────────────────────────────────────────────

  const drawScene = useCallback((cropX: number, cropY: number, cropSize: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Semi-transparent overlay around the crop rect (lightbox style)
    ctx.fillStyle = OVERLAY_ALPHA;
    ctx.fillRect(0, 0, canvas.width, cropY);                                           // top
    ctx.fillRect(0, cropY, cropX, cropSize);                                            // left
    ctx.fillRect(cropX + cropSize, cropY, canvas.width - cropX - cropSize, cropSize);   // right
    ctx.fillRect(0, cropY + cropSize, canvas.width, canvas.height - cropY - cropSize);  // bottom

    // White border around crop rect
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.strokeRect(cropX, cropY, cropSize, cropSize);

    // Dimension label (in original image pixels) above the crop rect
    const scaleX = img.naturalWidth / canvas.width;
    const dimW = Math.round(cropSize * scaleX);
    ctx.fillStyle = BORDER_COLOR;
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`${dimW}×${dimW}`, cropX + cropSize / 2, cropY - 8);

    // Corner handles
    const half = HANDLE_SIZE / 2;
    const corners = [
      { x: cropX - half, y: cropY - half },
      { x: cropX + cropSize - half, y: cropY - half },
      { x: cropX - half, y: cropY + cropSize - half },
      { x: cropX + cropSize - half, y: cropY + cropSize - half },
    ];
    ctx.fillStyle = HANDLE_FILL;
    ctx.strokeStyle = HANDLE_STROKE;
    ctx.lineWidth = 1;
    for (const h of corners) {
      ctx.fillRect(h.x, h.y, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(h.x, h.y, HANDLE_SIZE, HANDLE_SIZE);
    }
  }, []);

  // ── Image loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    setImageLoaded(false);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageSrc;
    return () => { img.onload = null; };
  }, [imageSrc]);

  // ── Canvas sizing + default crop ────────────────────────────────────────────

  useEffect(() => {
    if (!imageLoaded || !containerRef.current || !canvasRef.current || !imgRef.current) return;

    const img = imgRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current;

    const containerW = container.clientWidth;
    if (containerW <= 0) return;

    const aspect = img.naturalHeight / img.naturalWidth;
    const cw = Math.round(containerW);
    const ch = Math.round(cw * aspect);
    canvas.width = cw;
    canvas.height = ch;

    // Default crop: centred, full square of the smaller dimension (edge-to-edge)
    const rawCropSize = Math.min(img.naturalWidth, img.naturalHeight) * 1.0;
    const rawCropX = (img.naturalWidth - rawCropSize) / 2;
    const rawCropY = (img.naturalHeight - rawCropSize) / 2;

    const scale = cw / img.naturalWidth;
    const cCropX = Math.round(rawCropX * scale);
    const cCropY = Math.round(rawCropY * scale);
    const cCropSize = Math.round(rawCropSize * scale);

    const defaultCrop = { x: cCropX, y: cCropY, size: cCropSize };
    currentCropRef.current = defaultCrop;
    drawScene(cCropX, cCropY, cCropSize);
    emitCrop(defaultCrop);
  }, [imageLoaded, drawScene, emitCrop]);

  // ── Cursor on hover (no drag) ───────────────────────────────────────────────

  const updateCursor = useCallback((px: number, py: number) => {
    const crop = currentCropRef.current;
    if (!crop) { setCursor('crosshair'); return; }

    const corner = hitTestCorner(px, py, crop);
    if (corner) { setCursor(cornerCursor(corner)); return; }
    if (insideRect(px, py, crop)) { setCursor('move'); return; }
    setCursor('crosshair');
  }, []);

  // ── Mouse handlers ──────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e.clientX, e.clientY, canvasRef.current);
    const crop = currentCropRef.current;
    if (!crop) return;

    const corner = hitTestCorner(pos.x, pos.y, crop);
    if (corner) {
      // Resize from corner
      dragRef.current = {
        mode: 'resize', corner,
        startX: pos.x, startY: pos.y,
        origX: crop.x, origY: crop.y, origSize: crop.size,
      };
      return;
    }

    if (insideRect(pos.x, pos.y, crop)) {
      // Move
      dragRef.current = {
        mode: 'move', corner: null,
        startX: pos.x, startY: pos.y,
        origX: crop.x, origY: crop.y, origSize: crop.size,
      };
      return;
    }

    // Draw new
    dragRef.current = {
      mode: 'draw', corner: null,
      startX: pos.x, startY: pos.y,
      origX: pos.x, origY: pos.y, origSize: 0,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e.clientX, e.clientY, canvasRef.current);
    const drag = dragRef.current;

    if (drag.mode === 'idle') {
      updateCursor(pos.x, pos.y);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (drag.mode === 'draw') {
      const dx = pos.x - drag.startX;
      const dy = pos.y - drag.startY;
      let size = Math.max(Math.abs(dx), Math.abs(dy), MIN_CROP_SIZE);
      let x = dx >= 0 ? drag.startX : drag.startX - size;
      let y = dy >= 0 ? drag.startY : drag.startY - size;
      const clamped = clampRect(x, y, size, canvas.width, canvas.height);
      currentCropRef.current = clamped;
      drawScene(clamped.x, clamped.y, clamped.size);
      return;
    }

    if (drag.mode === 'move') {
      const dx = pos.x - drag.startX;
      const dy = pos.y - drag.startY;
      const clamped = clampRect(
        drag.origX + dx, drag.origY + dy, drag.origSize,
        canvas.width, canvas.height,
      );
      currentCropRef.current = clamped;
      drawScene(clamped.x, clamped.y, clamped.size);
      return;
    }

    if (drag.mode === 'resize' && drag.corner) {
      // The opposite corner stays fixed; size = max(|dx|, |dy|) for 1:1
      const opposite = {
        tl: { x: drag.origX + drag.origSize, y: drag.origY + drag.origSize },
        tr: { x: drag.origX, y: drag.origY + drag.origSize },
        bl: { x: drag.origX + drag.origSize, y: drag.origY },
        br: { x: drag.origX, y: drag.origY },
      }[drag.corner];

      const size = Math.max(
        Math.abs(pos.x - opposite.x), Math.abs(pos.y - opposite.y), MIN_CROP_SIZE,
      );

      // Determine top-left based on which corner is fixed
      let x: number, y: number;
      switch (drag.corner) {
        case 'br': x = opposite.x; y = opposite.y; break;
        case 'bl': x = opposite.x - size; y = opposite.y; break;
        case 'tr': x = opposite.x; y = opposite.y - size; break;
        case 'tl': x = opposite.x - size; y = opposite.y - size; break;
      }

      const clamped = clampRect(x, y, size, canvas.width, canvas.height);
      currentCropRef.current = clamped;
      drawScene(clamped.x, clamped.y, clamped.size);
      return;
    }
  }, [drawScene, updateCursor]);

  const handleMouseUp = useCallback(() => {
    const drag = dragRef.current;
    if (drag.mode === 'idle') return;

    const finalCrop = currentCropRef.current;
    dragRef.current = makeDragState();

    if (finalCrop) emitCrop(finalCrop);
  }, [emitCrop]);

  // ── Keyboard handler ────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const crop = currentCropRef.current;
    if (!crop) return;

    const step = e.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;
    switch (e.key) {
      case 'ArrowUp': dy = -step; break;
      case 'ArrowDown': dy = step; break;
      case 'ArrowLeft': dx = -step; break;
      case 'ArrowRight': dx = step; break;
      default: return;
    }
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const clamped = clampRect(crop.x + dx, crop.y + dy, crop.size, canvas.width, canvas.height);
    currentCropRef.current = clamped;
    drawScene(clamped.x, clamped.y, clamped.size);
    emitCrop(clamped);
  }, [drawScene, emitCrop]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="cropper-container"
      style={{ position: 'relative', width: '100%' }}
    >
      {!imageLoaded && (
        <div className="cropper-loading" style={{ padding: '1rem', textAlign: 'center' }}>
          Loading image…
        </div>
      )}
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label="Crop area. Use arrow keys to adjust."
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          display: imageLoaded ? 'block' : 'none',
          width: '100%',
          cursor,
        }}
      />
    </div>
  );
}
