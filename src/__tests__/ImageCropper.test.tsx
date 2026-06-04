import { render, fireEvent, act } from '@testing-library/react';
import ImageCropper from '../ImageCropper';

describe('ImageCropper', () => {
  let imageOnloadFn: (() => void) | null = null;

  beforeEach(() => {
    imageOnloadFn = null;

    // Mock canvas 2D context
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      canvas: { width: 0, height: 0 } as HTMLCanvasElement,
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      setLineDash: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
    } as unknown as CanvasRenderingContext2D);

    // Mock Image constructor — capture onload callback for manual trigger
    let mockImageInstance: {
      onload: (() => void) | null;
      src: string;
      naturalWidth: number;
      naturalHeight: number;
    } | null = null;

    class MockImage {
      onload: (() => void) | null = null;
      _src = '';
      naturalWidth = 200;
      naturalHeight = 150;

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
    vi.restoreAllMocks();
  });

  function renderInContainer(ui: React.ReactElement) {
    const result = render(<div style={{ width: '400px' }}>{ui}</div>);
    return result;
  }

  it('renders a canvas element', () => {
    const { container } = renderInContainer(
      <ImageCropper imageSrc="test.png" onCropChange={vi.fn()} />,
    );
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('calls onCropChange with centered 80% default crop after image loads', () => {
    const onCropChange = vi.fn();
    const { container } = renderInContainer(
      <ImageCropper imageSrc="test.png" onCropChange={onCropChange} />,
    );

    // Hack: set clientWidth on the cropper container before triggering image load
    const cropperDiv = container.firstChild?.firstChild as HTMLElement;
    Object.defineProperty(cropperDiv, 'clientWidth', {
      value: 400,
      configurable: true,
    });

    // Trigger image load
    act(() => {
      imageOnloadFn?.();
    });

    // Image is 200×150 → 80% of min(200,150) = 120
    // Centered: x = (200-120)/2 = 40, y = (150-120)/2 = 15
    expect(onCropChange).toHaveBeenCalledWith({
      x: 40,
      y: 15,
      width: 120,
      height: 120,
    });
  });

  it('updates crop rect on mouse drag (mousedown → mousemove → mouseup)', () => {
    const onCropChange = vi.fn();
    const { container } = renderInContainer(
      <ImageCropper imageSrc="test.png" onCropChange={onCropChange} />,
    );

    // Set container width
    const cropperDiv = container.firstChild?.firstChild as HTMLElement;
    Object.defineProperty(cropperDiv, 'clientWidth', {
      value: 400,
      configurable: true,
    });

    // Trigger image load
    act(() => {
      imageOnloadFn?.();
    });

    // Reset mock after default crop call
    onCropChange.mockClear();

    // Set up canvas bounding rect for coordinate conversion
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 400, writable: true });
    Object.defineProperty(canvas, 'height', { value: 300, writable: true });
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    // Drag: mousedown(250, 150) → mousemove(300, 200) → mouseup
    // dx=50, dy=50, size=50 — 1:1 aspect ratio
    fireEvent.mouseDown(canvas, { clientX: 250, clientY: 150 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 200 });
    fireEvent.mouseUp(canvas, { clientX: 300, clientY: 200 });

    // Crop in image pixels: scale = 200/400 = 0.5
    // Crop starts at (250, 150) canvas px → image px: (125, 75)
    // Size = 50 canvas px → image px: 25
    // Direction: positive dx/dy, so start point is (250, 150)
    // Final crop in canvas coords: x=250, y=150, size=50
    // In image coords: x=125, y=75, width=25, height=25
    expect(onCropChange).toHaveBeenCalledWith({
      x: 125,
      y: 75,
      width: 25,
      height: 25,
    });
  });
});
