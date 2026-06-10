import { useCallback } from 'react';
import type { HsbAdjustment } from '../api';
import { useLocalStorage } from './useLocalStorage';

const NORMAL_ADJ: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: 0 };
const HOVER_ADJ: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: 30 };
const ACTIVE_ADJ: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: -40 };
const DEFAULT_ARRAY: [HsbAdjustment, HsbAdjustment, HsbAdjustment] = [NORMAL_ADJ, HOVER_ADJ, ACTIVE_ADJ];

export function useHsbAdjustments() {
  const [offAdjustments, setOffAdjustments] = useLocalStorage<[HsbAdjustment, HsbAdjustment, HsbAdjustment]>(
    'grove-offAdjustments', DEFAULT_ARRAY,
  );
  const [onAdjustments, setOnAdjustments] = useLocalStorage<[HsbAdjustment, HsbAdjustment, HsbAdjustment]>(
    'grove-onAdjustments', DEFAULT_ARRAY,
  );

  const updateOff = useCallback((index: 0 | 1 | 2, adj: HsbAdjustment) => {
    setOffAdjustments((prev) => {
      const next = [...prev] as [HsbAdjustment, HsbAdjustment, HsbAdjustment];
      next[index] = adj;
      return next;
    });
  }, [setOffAdjustments]);

  const updateOn = useCallback((index: 0 | 1 | 2, adj: HsbAdjustment) => {
    setOnAdjustments((prev) => {
      const next = [...prev] as [HsbAdjustment, HsbAdjustment, HsbAdjustment];
      next[index] = adj;
      return next;
    });
  }, [setOnAdjustments]);

  const resetAll = useCallback(() => {
    setOffAdjustments(DEFAULT_ARRAY);
    setOnAdjustments(DEFAULT_ARRAY);
  }, [setOffAdjustments, setOnAdjustments]);

  return { offAdjustments, onAdjustments, updateOff, updateOn, resetAll };
}
