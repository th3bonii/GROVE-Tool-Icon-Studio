import { useRef, useState, useEffect, useCallback } from 'react';
import type { CropArea } from './api';

interface ImageCropperProps {
  imageSrc: string;
  onCropChange: (crop: CropArea | null) => void;
}

const MIN_CROP_SIZE = 10;
const OVERLAY_ALPHA = 'rgba(0, 0, 0, 0.5)';
const BORDER_COLOR = '#fff';
const STROKE_WIDTH = 2;
const LABEL_FONT = '14px sans-serif';

export default function ImageCropper({ imageSrc, onCropChange }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCropChangeRef = useRef(onCropChange);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number }>({
    active: false,
    startX: 0,
    startY: 0,
  });
  const currentCropRef = useRef<{ x: number; y: number; size: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Keep callback ref synchronised (avoids re-triggering effects on callback change)
  useEffect(() => {
    onCropChangeRef.current = onCropChange;
  });

  // ── Drawing ────────────────────────────────────────────────────────────────

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
    // Top strip
    ctx.fillRect(0, 0, canvas.width, cropY);
    // Left strip
    ctx.fillRect(0, cropY, cropX, cropSize);
    // Right strip
    ctx.fillRect(cropX + cropSize, cropY, canvas.width - cropX - cropSize, cropSize);
    // Bottom strip
    ctx.fillRect(0, cropY + cropSize, canvas.width, canvas.height - cropY - cropSize);

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
  }, []);

  // ── Image loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageSrc;

    return () => {
      img.onload = null;
    };
  }, [imageSrc]);

  // ── Canvas sizing + default crop ───────────────────────────────────────────

  useEffect(() => {
    if (!imageLoaded || !containerRef.current || !canvasRef.current || !imgRef.current) {
      return;
    }

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

    // Default crop: centred, 80 % of the smaller original dimension
    const rawCropSize = Math.min(img.naturalWidth, img.naturalHeight) * 0.8;
    const rawCropX = (img.naturalWidth - rawCropSize) / 2;
    const rawCropY = (img.naturalHeight - rawCropSize) / 2;

    // Convert default crop to canvas pixels
    const scaleX = cw / img.naturalWidth;
    const cCropX = Math.round(rawCropX * scaleX);
    const cCropY = Math.round(rawCropY * scaleX); // same scale (1:1 aspect)
    const cCropSize = Math.round(rawCropSize * scaleX);

    const defaultCrop = { x: cCropX, y: cCropY, size: cCropSize };
    currentCropRef.current = defaultCrop;
    drawScene(cCropX, cCropY, cCropSize);

    // Emit crop in original image coordinates
    onCropChangeRef.current({
      x: Math.round(rawCropX),
      y: Math.round(rawCropY),
      width: Math.round(rawCropSize),
      height: Math.round(rawCropSize),
    });
  }, [imageLoaded, drawScene]);

  // ── Coordinate conversion ──────────────────────────────────────────────────

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  // ── Mouse handlers ─────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getCanvasCoords(e.clientX, e.clientY);
      dragRef.current = { active: true, startX: pos.x, startY: pos.y };
    },
    [getCanvasCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragRef.current.active) return;

      const pos = getCanvasCoords(e.clientX, e.clientY);
      const { startX, startY } = dragRef.current;
      const dx = pos.x - startX;
      const dy = pos.y - startY;

      // Clamp to 1:1 aspect ratio and minimum size
      let size = Math.max(Math.abs(dx), Math.abs(dy), MIN_CROP_SIZE);
      let x = dx >= 0 ? startX : startX - size;
      let y = dy >= 0 ? startY : startY - size;

      // Clamp to canvas bounds
      const canvas = canvasRef.current;
      if (canvas) {
        x = Math.max(0, Math.min(x, canvas.width - size));
        y = Math.max(0, Math.min(y, canvas.height - size));
      }

      currentCropRef.current = { x, y, size };
      drawScene(x, y, size);
    },
    [getCanvasCoords, drawScene],
  );

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;

    const finalCrop = currentCropRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!finalCrop || !canvas || !img) return;

    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;

    onCropChangeRef.current({
      x: Math.round(finalCrop.x * scaleX),
      y: Math.round(finalCrop.y * scaleY),
      width: Math.round(finalCrop.size * scaleX),
      height: Math.round(finalCrop.size * scaleY),
    });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          display: imageLoaded ? 'block' : 'none',
          width: '100%',
          cursor: 'crosshair',
        }}
      />
    </div>
  );
}
