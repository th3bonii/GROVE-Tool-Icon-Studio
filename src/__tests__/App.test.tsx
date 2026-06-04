import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock Tauri invoke — used by api.ts (detectReaperPath, processIcon)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ path: null, method: 'Manual' }),
}));

// Mock Tauri dialog — used by App.tsx directly (open)
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

describe('App', () => {
  it('renders the application title', () => {
    render(<App />);
    expect(screen.getByText('GROVE Icon Studio')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<App />);
    expect(
      screen.getByText('REAPER 3-State Toolbar Icon Generator'),
    ).toBeInTheDocument();
  });

  it('renders the REAPER Resource Path section', () => {
    render(<App />);
    expect(screen.getByText('REAPER Resource Path')).toBeInTheDocument();
  });

  it('renders the Source Icon section', () => {
    render(<App />);
    expect(screen.getByText('Source Icon')).toBeInTheDocument();
  });

  it('renders the Generate button', () => {
    render(<App />);
    expect(screen.getByText('Generate 3-State Icon')).toBeInTheDocument();
  });
});
