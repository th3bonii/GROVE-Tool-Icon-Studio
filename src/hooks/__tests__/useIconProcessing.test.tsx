import { renderHook, act } from '@testing-library/react';
import { useIconProcessing } from '../useIconProcessing';
import type { HsbAdjustment } from '../../api';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('useIconProcessing with HSB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  it('passes HSB adjustments to processIcon via handleGenerate', async () => {
    const { result } = renderHook(() => useIconProcessing());
    const adj: HsbAdjustment = { hue_shift: 30, sat_delta: -50, bri_delta: 25 };
    const adjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment] = [adj, adj, adj];
    const crop = { x: 0, y: 0, width: 32, height: 32 };

    await act(async () => {
      await result.current.handleGenerate(
        '/path/file.png',
        '/reaper',
        crop,
        2,
        true,
        adjustments,
        adjustments,
      );
    });

    expect(mockInvoke).toHaveBeenCalledWith('process_icon', {
      inputPath: '/path/file.png',
      outputDir: '/reaper',
      crop,
      padding: 2,
      isToggle: true,
      offAdjustments: adjustments,
      onAdjustments: adjustments,
    });
  });

  it('omits HSB adjustments when not provided', async () => {
    const { result } = renderHook(() => useIconProcessing());
    const crop = { x: 0, y: 0, width: 32, height: 32 };

    await act(async () => {
      await result.current.handleGenerate(
        '/path/file.png',
        '/reaper',
        crop,
        2,
        false,
      );
    });

    expect(mockInvoke).toHaveBeenCalledWith('process_icon', {
      inputPath: '/path/file.png',
      outputDir: '/reaper',
      crop,
      padding: 2,
      isToggle: false,
      offAdjustments: null,
      onAdjustments: null,
    });
  });
});
