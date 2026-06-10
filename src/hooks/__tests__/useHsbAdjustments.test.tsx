import { renderHook, act } from '@testing-library/react';
import { useHsbAdjustments } from '../useHsbAdjustments';
import type { HsbAdjustment } from '../../api';

describe('useHsbAdjustments', () => {
  beforeEach(() => localStorage.clear());
  const defaultAdj: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: 0 };
  const hoverAdj: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: 30 };
  const activeAdj: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: -40 };
  const expectedDefaultTuple: [HsbAdjustment, HsbAdjustment, HsbAdjustment] = [
    defaultAdj, hoverAdj, activeAdj,
  ];

  it('initializes with all-zero adjustments for OFF and ON', () => {
    const { result } = renderHook(() => useHsbAdjustments());
    expect(result.current.offAdjustments).toEqual(expectedDefaultTuple);
    expect(result.current.onAdjustments).toEqual(expectedDefaultTuple);
  });

  it('updateOff updates a specific index in OFF', () => {
    const { result } = renderHook(() => useHsbAdjustments());
    const adj: HsbAdjustment = { hue_shift: 10, sat_delta: 20, bri_delta: -5 };

    act(() => {
      result.current.updateOff(1, adj);
    });

    expect(result.current.offAdjustments[0]).toEqual(defaultAdj);
    expect(result.current.offAdjustments[1]).toEqual(adj);
    expect(result.current.offAdjustments[2]).toEqual(activeAdj);
    // ON should remain unchanged
    expect(result.current.onAdjustments).toEqual(expectedDefaultTuple);
  });

  it('updateOn updates a specific index in ON', () => {
    const { result } = renderHook(() => useHsbAdjustments());
    const adj: HsbAdjustment = { hue_shift: -30, sat_delta: 50, bri_delta: 100 };

    act(() => {
      result.current.updateOn(2, adj);
    });

    expect(result.current.onAdjustments[0]).toEqual(defaultAdj);
    expect(result.current.onAdjustments[1]).toEqual(hoverAdj);
    expect(result.current.onAdjustments[2]).toEqual(adj);
    // OFF should remain unchanged
    expect(result.current.offAdjustments).toEqual(expectedDefaultTuple);
  });

  it('resetAll resets both OFF and ON to defaults', () => {
    const { result } = renderHook(() => useHsbAdjustments());

    // First change some values
    act(() => {
      result.current.updateOff(0, { hue_shift: 45, sat_delta: -20, bri_delta: 10 });
      result.current.updateOn(1, { hue_shift: -90, sat_delta: 30, bri_delta: -50 });
    });

    // Then reset
    act(() => {
      result.current.resetAll();
    });

    expect(result.current.offAdjustments).toEqual(expectedDefaultTuple);
    expect(result.current.onAdjustments).toEqual(expectedDefaultTuple);
  });

  it('updateOff does not mutate previous state', () => {
    const { result } = renderHook(() => useHsbAdjustments());
    const firstSnapshot = result.current.offAdjustments;

    act(() => {
      result.current.updateOff(0, { hue_shift: 10, sat_delta: 10, bri_delta: 10 });
    });

    // The original reference should be different
    expect(result.current.offAdjustments).not.toBe(firstSnapshot);
  });
});
