import { renderHook, act } from '@testing-library/react';
import { useBatchProcessing } from '../useBatchProcessing';
import type { HsbAdjustment } from '../../api';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('useBatchProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty files and no progress', () => {
    const { result } = renderHook(() => useBatchProcessing());
    expect(result.current.files).toEqual([]);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progress).toEqual({ done: 0, total: 0 });
  });

  it('addFiles creates pending BatchFile entries with correct names', () => {
    const { result } = renderHook(() => useBatchProcessing());

    act(() => {
      result.current.addFiles(['/path/to/icon_mute.png', '/path/to/icon_solo.png']);
    });

    expect(result.current.files).toHaveLength(2);
    expect(result.current.files[0].name).toBe('icon_mute');
    expect(result.current.files[0].status).toBe('pending');
    expect(result.current.files[0].path).toBe('/path/to/icon_mute.png');

    expect(result.current.files[1].name).toBe('icon_solo');
    expect(result.current.files[1].status).toBe('pending');
  });

  it('addFiles handles file stems without extension correctly', () => {
    const { result } = renderHook(() => useBatchProcessing());

    act(() => {
      result.current.addFiles(['C:\\Windows\\icon.test.png']);
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].name).toBe('icon.test');
  });

  it('addFiles appends to existing files', () => {
    const { result } = renderHook(() => useBatchProcessing());

    act(() => {
      result.current.addFiles(['/path/first.png']);
    });

    act(() => {
      result.current.addFiles(['/path/second.png']);
    });

    expect(result.current.files).toHaveLength(2);
    expect(result.current.files[0].name).toBe('first');
    expect(result.current.files[1].name).toBe('second');
  });

  it('clearFiles empties the file list and resets progress', () => {
    const { result } = renderHook(() => useBatchProcessing());

    act(() => {
      result.current.addFiles(['/path/a.png', '/path/b.png']);
    });

    expect(result.current.files).toHaveLength(2);

    act(() => {
      result.current.clearFiles();
    });

    expect(result.current.files).toEqual([]);
    expect(result.current.progress).toEqual({ done: 0, total: 0 });
  });

  it('removeFile removes a file at the given index', () => {
    const { result } = renderHook(() => useBatchProcessing());

    act(() => {
      result.current.addFiles(['/path/a.png', '/path/b.png', '/path/c.png']);
    });

    act(() => {
      result.current.removeFile(1);
    });

    expect(result.current.files).toHaveLength(2);
    expect(result.current.files[0].name).toBe('a');
    expect(result.current.files[1].name).toBe('c');
  });

  it('processAll calls previewIcon for each file sequentially', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'preview_icon') return Promise.resolve([{ width: 32, height: 32, output_path: null, preview_base64: 'data:', suffix: '' }]);
      return Promise.resolve([]);
    });

    const { result } = renderHook(() => useBatchProcessing());

    act(() => {
      result.current.addFiles(['/path/a.png', '/path/b.png']);
    });

    const noAdj: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: 0 };
    const adjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment] = [noAdj, noAdj, noAdj];

    await act(async () => {
      await result.current.processAll(null, 2, false, adjustments, adjustments);
    });

    // Should have called previewIcon twice
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'preview_icon', {
      inputPath: '/path/a.png',
      crop: null,
      padding: 2,
      isToggle: false,
      offAdjustments: adjustments,
      onAdjustments: adjustments,
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'preview_icon', {
      inputPath: '/path/b.png',
      crop: null,
      padding: 2,
      isToggle: false,
      offAdjustments: adjustments,
      onAdjustments: adjustments,
    });

    // Both should be done
    expect(result.current.files[0].status).toBe('done');
    expect(result.current.files[1].status).toBe('done');
    expect(result.current.files[0].results).toHaveLength(1);
    expect(result.current.progress).toEqual({ done: 2, total: 2 });
    expect(result.current.isProcessing).toBe(false);
  });

  it('processAll handles file errors without blocking remaining files', async () => {
    mockInvoke
      .mockResolvedValueOnce([{ width: 32, height: 32, output_path: null, preview_base64: 'data:', suffix: '' }])
      .mockRejectedValueOnce(new Error('Processing failed'))
      .mockResolvedValueOnce([{ width: 32, height: 32, output_path: null, preview_base64: 'data:', suffix: '' }]);

    const { result } = renderHook(() => useBatchProcessing());

    act(() => {
      result.current.addFiles(['/path/ok1.png', '/path/bad.png', '/path/ok2.png']);
    });

    const noAdj: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: 0 };
    const adjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment] = [noAdj, noAdj, noAdj];

    await act(async () => {
      await result.current.processAll(null, 2, false, adjustments, adjustments);
    });

    // First file done, second errored, third done
    expect(result.current.files[0].status).toBe('done');
    expect(result.current.files[1].status).toBe('error');
    expect(result.current.files[1].error).toContain('Processing failed');
    expect(result.current.files[2].status).toBe('done');
    expect(result.current.progress).toEqual({ done: 2, total: 3 });
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });

  it('setIsProcessing state is correctly managed', () => {
    const { result } = renderHook(() => useBatchProcessing());

    expect(result.current.isProcessing).toBe(false);
  });

  it('resetProgress resets all files to pending and clears progress', () => {
    const { result } = renderHook(() => useBatchProcessing());

    act(() => {
      result.current.addFiles(['/path/a.png', '/path/b.png']);
    });

    act(() => {
      result.current.resetProgress();
    });

    expect(result.current.files[0].status).toBe('pending');
    expect(result.current.files[1].status).toBe('pending');
    expect(result.current.files[0].results).toBeUndefined();
    expect(result.current.files[0].error).toBeUndefined();
    expect(result.current.progress).toEqual({ done: 0, total: 0 });
  });
});
