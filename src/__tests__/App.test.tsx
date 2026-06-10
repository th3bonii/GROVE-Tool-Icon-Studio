import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../App';

// Mock Tauri invoke — used by api.ts (detectReaperPath, processIcon, previewIcon, etc.)
const mockInvoke = vi.fn().mockResolvedValue({ path: null, method: 'Manual' });

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

// Mock Tauri dialog — used by App.tsx directly (open)
const mockOpen = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => mockOpen(...args),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('renders the Select Icon File button', () => {
    render(<App />);
    expect(screen.getByText('Select Icon File')).toBeInTheDocument();
  });

  it('renders the Generate button (disabled initially)', () => {
    render(<App />);
    const btn = screen.getByText('Generate 3-State Icon');
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('renders the Crop & Preview section when a file is selected', async () => {
    // Mock a detected REAPER path so the install section also renders
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    // Wait for auto-detection to resolve
    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    // Click file select
    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(screen.getByText('Crop & Preview')).toBeInTheDocument();
    });
  });

  it('renders the Install section when REAPER path is detected', async () => {
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });

    render(<App />);

    await waitFor(() => {
      // "Install to REAPER" appears both as <h2> heading and checkbox label
      const headings = screen.getAllByText('Install to REAPER');
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the padding slider', async () => {
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(screen.getByText(/Padding:/)).toBeInTheDocument();
    });

    // Slider should show default value of 4px
    expect(screen.getByText('4px')).toBeInTheDocument();

    // Slider marks should show 0-4 range
    // (use getAllByText since HSB slider values also show "0")
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders the toggle checkbox', async () => {
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(
        screen.getByLabelText('Generate ON/OFF toggle variant'),
      ).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText(
      'Generate ON/OFF toggle variant',
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it('shows the file path after selecting an icon', async () => {
    mockInvoke.mockResolvedValue({ path: null, method: 'Manual' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(screen.getByText('/mock/icons/source.png')).toBeInTheDocument();
    });
  });

  it('shows Change Icon button after selection', async () => {
    mockInvoke.mockResolvedValue({ path: null, method: 'Manual' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(screen.getByText('Change Icon')).toBeInTheDocument();
    });
  });

  it('shows the computed install path when REAPER path is detected', async () => {
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });

    render(<App />);

    await waitFor(() => {
      const section = screen.getByText('REAPER Resource Path').closest('section')!;
      expect(
        within(section).getByText('/mock/reaper/Data/toolbar_icons/'),
      ).toBeInTheDocument();
    });
  });
});
