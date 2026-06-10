import { renderHook, act } from '@testing-library/react';
import { useIconInstall } from '../useIconInstall';
import type { HsbAdjustment } from '../../api';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('useIconInstall with HSB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke
      .mockResolvedValueOnce([]) // installIconSet
      .mockResolvedValueOnce([]); // listInstalledIcons
  });

  it('handleInstallAction passes HSB adjustments to installIconSet', async () => {
    const { result } = renderHook(() =>
      useIconInstall('/reaper', vi.fn()),
    );

    const adj: HsbAdjustment = { hue_shift: 10, sat_delta: -20, bri_delta: 5 };
    const adjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment] = [adj, adj, adj];
    const crop = { x: 0, y: 0, width: 32, height: 32 };

    await act(async () => {
      await result.current.handleInstallAction(
        '/path/file.png',
        crop,
        2,
        true,
        'myicon',
        adjustments,
        adjustments,
      );
    });

    expect(mockInvoke).toHaveBeenCalledWith('install_icon_set', {
      inputPath: '/path/file.png',
      reaperResourcePath: '/reaper',
      targetName: 'myicon',
      crop,
      padding: 2,
      isToggle: true,
      offAdjustments: adjustments,
      onAdjustments: adjustments,
    });
  });

  it('handleInstallAction omits HSB adjustments when not provided', async () => {
    const { result } = renderHook(() =>
      useIconInstall('/reaper', vi.fn()),
    );

    const crop = { x: 0, y: 0, width: 32, height: 32 };

    await act(async () => {
      await result.current.handleInstallAction('/path/file.png', crop, 2, false, 'myicon');
    });

    expect(mockInvoke).toHaveBeenCalledWith('install_icon_set', {
      inputPath: '/path/file.png',
      reaperResourcePath: '/reaper',
      targetName: 'myicon',
      crop,
      padding: 2,
      isToggle: false,
      offAdjustments: null,
      onAdjustments: null,
    });
  });

  it('handleAutoInstall passes HSB adjustments to installIconSet', async () => {
    const { result } = renderHook(() =>
      useIconInstall('/reaper', vi.fn()),
    );

    const adj: HsbAdjustment = { hue_shift: 5, sat_delta: -10, bri_delta: 15 };
    const adjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment] = [adj, adj, adj];
    const crop = { x: 0, y: 0, width: 32, height: 32 };

    // Enable auto-install and set icon name so handleAutoInstall runs
    act(() => {
      result.current.setInstallEnabled(true);
      result.current.setIconName('testicon');
    });

    await act(async () => {
      await result.current.handleAutoInstall(
        '/path/file.png',
        '/reaper',
        crop,
        2,
        false,
        adjustments,
        adjustments,
      );
    });

    expect(mockInvoke).toHaveBeenCalledWith('install_icon_set', {
      inputPath: '/path/file.png',
      reaperResourcePath: '/reaper',
      targetName: 'testicon',
      crop,
      padding: 2,
      isToggle: false,
      offAdjustments: adjustments,
      onAdjustments: adjustments,
    });
  });
});
