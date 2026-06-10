import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Import AFTER mocking
const { processIcon, previewIcon, installIconSet, CORNER_RADIUS_FACTOR } = await import('../api');
import type { HsbAdjustment, CropArea } from '../api';

describe('CORNER_RADIUS_FACTOR', () => {
  it('has the correct value matching Rust', () => {
    expect(CORNER_RADIUS_FACTOR).toBe(0.15);
  });
});

describe('api HSB params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  const crop: CropArea = { x: 0, y: 0, width: 32, height: 32 };
  const adj: HsbAdjustment = { hue_shift: 10, sat_delta: -20, bri_delta: 5 };

  it('processIcon forwards off_adjustments and on_adjustments', async () => {
    await processIcon('/path/in', '/path/out', crop, 2, true, [adj, adj, adj], [adj, adj, adj]);

    expect(mockInvoke).toHaveBeenCalledWith('process_icon', {
      inputPath: '/path/in',
      outputDir: '/path/out',
      crop,
      padding: 2,
      isToggle: true,
      offAdjustments: [adj, adj, adj],
      onAdjustments: [adj, adj, adj],
    });
  });

  it('processIcon omits null HSB params', async () => {
    await processIcon('/path/in', '/path/out');

    expect(mockInvoke).toHaveBeenCalledWith('process_icon', {
      inputPath: '/path/in',
      outputDir: '/path/out',
      crop: null,
      padding: null,
      isToggle: null,
      offAdjustments: null,
      onAdjustments: null,
    });
  });

  it('previewIcon forwards off_adjustments and on_adjustments', async () => {
    await previewIcon('/path/in', crop, 2, true, [adj, adj, adj], [adj, adj, adj]);

    expect(mockInvoke).toHaveBeenCalledWith('preview_icon', {
      inputPath: '/path/in',
      crop,
      padding: 2,
      isToggle: true,
      offAdjustments: [adj, adj, adj],
      onAdjustments: [adj, adj, adj],
    });
  });

  it('previewIcon omits null HSB params', async () => {
    await previewIcon('/path/in');

    expect(mockInvoke).toHaveBeenCalledWith('preview_icon', {
      inputPath: '/path/in',
      crop: null,
      padding: null,
      isToggle: null,
      offAdjustments: null,
      onAdjustments: null,
    });
  });

  it('installIconSet forwards off_adjustments and on_adjustments', async () => {
    await installIconSet('/path/in', '/reaper', 'myname', crop, 2, true, [adj, adj, adj], [adj, adj, adj]);

    expect(mockInvoke).toHaveBeenCalledWith('install_icon_set', {
      inputPath: '/path/in',
      reaperResourcePath: '/reaper',
      targetName: 'myname',
      crop,
      padding: 2,
      isToggle: true,
      offAdjustments: [adj, adj, adj],
      onAdjustments: [adj, adj, adj],
    });
  });

  it('installIconSet omits null HSB params', async () => {
    await installIconSet('/path/in', '/reaper', 'myname');

    expect(mockInvoke).toHaveBeenCalledWith('install_icon_set', {
      inputPath: '/path/in',
      reaperResourcePath: '/reaper',
      targetName: 'myname',
      crop: null,
      padding: null,
      isToggle: null,
      offAdjustments: null,
      onAdjustments: null,
    });
  });
});
