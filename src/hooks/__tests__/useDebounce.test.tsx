import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update until the delay has elapsed', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } },
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 300 });

    // Should still show the old value before the delay
    expect(result.current).toBe('initial');

    // Advance time by 299ms — not quite enough
    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(result.current).toBe('initial');

    // Advance the remaining 1ms to hit exactly 300ms
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe('updated');
  });

  it('resets the timer when value changes rapidly', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 300 } },
    );

    // Change to 'b' — timer starts
    rerender({ value: 'b', delay: 300 });

    // Advance 100ms (timer has 200ms left)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Change to 'c' — timer resets
    rerender({ value: 'c', delay: 300 });

    // Advance 200ms — should NOT be enough since timer was just reset
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('a');

    // Advance the remaining 100ms to complete the 300ms delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('c');
  });

  it('works with numeric values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: number; delay: number }) =>
        useDebounce(value, delay),
      { initialProps: { value: 0, delay: 100 } },
    );

    rerender({ value: 42, delay: 100 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe(42);
  });

  it('handles delay of 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 0 } },
    );

    rerender({ value: 'b', delay: 0 });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe('b');
  });
});
