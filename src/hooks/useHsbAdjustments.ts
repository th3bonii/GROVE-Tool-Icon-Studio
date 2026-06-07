import { useCallback } from 'react';
import type { HsbAdjustment } from '../api';
import { useLocalStorage } from './useLocalStorage';

const DEFAULT_ADJ: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: 0 };
const DEFAULT_ARRAY: [HsbAdjustment, HsbAdjustment, HsbAdjustment] = [DEFAULT_ADJ, DEFAULT_ADJ, DEFAULT_ADJ];

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
    setOffAdjustments([DEFAULT_ADJ, DEFAULT_ADJ, DEFAULT_ADJ]);
    setOnAdjustments([DEFAULT_ADJ, DEFAULT_ADJ, DEFAULT_ADJ]);
  }, [setOffAdjustments, setOnAdjustments]);

  return { offAdjustments, onAdjustments, updateOff, updateOn, resetAll };
}
