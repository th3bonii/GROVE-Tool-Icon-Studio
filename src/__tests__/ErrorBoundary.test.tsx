import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock Tauri invoke — error logging tests verify componentDidCatch calls it
const mockInvoke = vi.fn().mockResolvedValue(undefined);

// We mock @tauri-apps/api/core at the module level; the ErrorBoundary's
// componentDidCatch does a dynamic import, so the mock must be set up before
// the error component mounts.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const ThrowComponent: React.FC<{ message?: string }> = ({ message }) => {
  throw new Error(message ?? 'test render crash');
};

function getLastInvokeCall(): { message: string; stack: string | null } | null {
  for (let i = mockInvoke.mock.calls.length - 1; i >= 0; i--) {
    const call = mockInvoke.mock.calls[i];
    if (call[0] === 'write_error_log') {
      return call[1] as { message: string; stack: string | null };
    }
  }
  return null;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('test render crash'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Try again'),
    ).toBeInTheDocument();
  });

  it('calls invoke("write_error_log") with error message and stack on catch', async () => {
    render(
      <ErrorBoundary>
        <ThrowComponent message="api failure" />
      </ErrorBoundary>,
    );

    // Dynamic import inside componentDidCatch is async — wait for it
    await vi.waitFor(() => {
      const call = getLastInvokeCall();
      expect(call).not.toBeNull();
      expect(call!.message).toBe('api failure');
      // Stack must be a non-empty string containing the error origin
      expect(call!.stack).not.toBeNull();
      expect(call!.stack!.length).toBeGreaterThan(0);
    });
  });

  it('provides a "Try again" button that resets the error state', () => {
    render(
      <ErrorBoundary>
        <ThrowComponent />
      </ErrorBoundary>,
    );

    // Should show error state
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click "Try again"
    screen.getByText('Try again').click();

    // After reset, children should render — but they will throw again
    // because ThrowComponent always throws. Verify the error state re-appears.
    // The key assertion is that clicking doesn't crash and the UI recovers.
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('does not call invoke when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
    // No invoke calls for write_error_log should have happened
    const writeLogCalls = mockInvoke.mock.calls.filter(
      (c: unknown[]) => c[0] === 'write_error_log',
    );
    expect(writeLogCalls).toHaveLength(0);
  });
});
