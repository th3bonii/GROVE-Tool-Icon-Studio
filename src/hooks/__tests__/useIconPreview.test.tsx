import { renderHook, waitFor } from '@testing-library/react';
import { useIconPreview } from '../useIconPreview';
import type { HsbAdjustment, ProcessingOutput } from '../../api';

// Mock invoke through api.ts → @tauri-apps/api/core
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

function makePreviewOutput(height: number): ProcessingOutput {
  return {
    width: height * 3,
    height,
    output_path: null,
    preview_base64: 'data:image/png;base64,iVBORw0KGgo=',
    suffix: '',
  };
}

describe('useIconPreview with HSB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes offAdjustments and onAdjustments to previewIcon', async () => {
    const adj: HsbAdjustment = { hue_shift: 15, sat_delta: -30, bri_delta: 10 };
    const adjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment] = [adj, adj, adj];

    mockInvoke.mockResolvedValue([
      makePreviewOutput(30),
      makePreviewOutput(45),
      makePreviewOutput(60),
    ]);

    renderHook(() =>
      useIconPreview(
        '/path/file.png',
        { x: 0, y: 0, width: 32, height: 32 },
        2,
        false,
        adjustments,
        adjustments,
      ),
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });

    const callArgs = mockInvoke.mock.calls[0];
    expect(callArgs[0]).toBe('preview_icon');
    expect(callArgs[1].offAdjustments).toEqual(adjustments);
    expect(callArgs[1].onAdjustments).toEqual(adjustments);
  });

  it('passes undefined HSB params as null when not provided', async () => {
    mockInvoke.mockResolvedValue([
      makePreviewOutput(30),
    ]);

    renderHook(() =>
      useIconPreview(
        '/path/file.png',
        { x: 0, y: 0, width: 32, height: 32 },
        2,
        false,
      ),
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });

    const callArgs = mockInvoke.mock.calls[0];
    expect(callArgs[1].offAdjustments).toBeNull();
    expect(callArgs[1].onAdjustments).toBeNull();
  });
});
