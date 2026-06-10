import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -----------------------------------------------------------------------
  // Scenario 1: Basic set/get
  // -----------------------------------------------------------------------

  it('writes a value and reads it back', () => {
    const { result } = renderHook(() =>
      useLocalStorage('theme', 'dark'),
    );

    act(() => {
      result.current[1]('light');
    });

    expect(result.current[0]).toBe('light');
  });

  // -----------------------------------------------------------------------
  // Scenario 2: Overwrite
  // -----------------------------------------------------------------------

  it('overwrites a previously stored value', () => {
    const { result } = renderHook(() =>
      useLocalStorage('pref', 'a'),
    );

    act(() => {
      result.current[1]('b');
    });

    expect(result.current[0]).toBe('b');

    // Overwrite again
    act(() => {
      result.current[1]('c');
    });

    expect(result.current[0]).toBe('c');
  });

  // -----------------------------------------------------------------------
  // Scenario 3: Functional update
  // -----------------------------------------------------------------------

  it('supports functional update with previous value', () => {
    const { result } = renderHook(() =>
      useLocalStorage('count', 0),
    );

    expect(result.current[0]).toBe(0);

    act(() => {
      result.current[1]((prev: number) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Scenario 4: Missing key → default
  // -----------------------------------------------------------------------

  it('returns default when key has no stored value', () => {
    const { result } = renderHook(() =>
      useLocalStorage('missingKey', 'fallback'),
    );

    expect(result.current[0]).toBe('fallback');
  });

  // -----------------------------------------------------------------------
  // Scenario 5: JSON parse error → default
  // -----------------------------------------------------------------------

  it('returns default when stored value is malformed JSON', () => {
    localStorage.setItem('corrupt', 'not-json');

    const { result } = renderHook(() =>
      useLocalStorage('corrupt', 'safe-default'),
    );

    expect(result.current[0]).toBe('safe-default');
  });

  // -----------------------------------------------------------------------
  // Scenario 6: Version mismatch → default
  // -----------------------------------------------------------------------

  it('returns default when stored schema version does not match', () => {
    // Store data with _version: 0 while PERSISTENCE_VERSION is 1
    localStorage.setItem('oldSchema', JSON.stringify({ _version: 0, data: 'old' }));

    const { result } = renderHook(() =>
      useLocalStorage('oldSchema', 'reset'),
    );

    expect(result.current[0]).toBe('reset');
  });

  // -----------------------------------------------------------------------
  // Scenario 7: Storage full → silent fail
  // -----------------------------------------------------------------------

  it('silently fails when localStorage throws QuotaExceededError', () => {
    const originalSetItem = Storage.prototype.setItem;
    const mockSetItem = vi.fn(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    Storage.prototype.setItem = mockSetItem;

    const { result } = renderHook(() =>
      useLocalStorage('key', 'default'),
    );

    expect(result.current[0]).toBe('default');

    // Attempt to set — should not throw
    expect(() => {
      act(() => {
        result.current[1]('new value');
      });
    }).not.toThrow();

    // The in-memory state should still reflect the attempted update
    expect(result.current[0]).toBe('new value');

    Storage.prototype.setItem = originalSetItem;
  });

  // -----------------------------------------------------------------------
  // Scenario 8: Multiple keys don't interfere
  // -----------------------------------------------------------------------

  it('two hooks with different keys operate independently', () => {
    const { result: resultA } = renderHook(() =>
      useLocalStorage('keyA', 'valueA'),
    );
    const { result: resultB } = renderHook(() =>
      useLocalStorage('keyB', 'valueB'),
    );

    expect(resultA.current[0]).toBe('valueA');
    expect(resultB.current[0]).toBe('valueB');

    // Update only key A
    act(() => {
      resultA.current[1]('updatedA');
    });

    expect(resultA.current[0]).toBe('updatedA');
    expect(resultB.current[0]).toBe('valueB');
  });

  // -----------------------------------------------------------------------
  // Scenario 9: Mount/unmount safety
  // -----------------------------------------------------------------------

  it('setValue after unmount does not throw or warn', () => {
    const { result, unmount } = renderHook(() =>
      useLocalStorage('safeKey', 'default'),
    );

    unmount();

    // Calling setValue after unmount should not throw
    expect(() => {
      act(() => {
        result.current[1]('after unmount');
      });
    }).not.toThrow();
  });
});
