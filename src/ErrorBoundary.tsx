import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _info: React.ErrorInfo) {
    // Fire-and-forget: persist the error via Tauri IPC without blocking render recovery.
    // Dynamic import avoids breaking environments where @tauri-apps/api/core may not
    // be available (e.g., plain browser dev).
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('write_error_log', {
        message: error.message,
        stack: error.stack ?? null,
      }).catch(() => {
        // Silently ignore — error logging must never block the UI.
      });
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p className="error-boundary-message">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            className="error-boundary-retry"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
