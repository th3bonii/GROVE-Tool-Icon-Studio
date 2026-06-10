import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

const mockOpen = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => mockOpen(...args),
}));

// ImageCropper doesn't work in jsdom (needs Image + canvas), so mock it
// to simulate setting a default crop area when it mounts.
vi.mock('../ImageCropper', () => {
  const React = require('react');
  return {
    default: ({ onCropChange }: { onCropChange: (crop: { x: number; y: number; width: number; height: number }) => void }) => {
      React.useEffect(() => {
        onCropChange({ x: 0, y: 0, width: 256, height: 256 });
      }, [onCropChange]);
      return null;
    },
  };
});

describe('App with HSB controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders HSB Adjustments heading when a file is selected', async () => {
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(screen.getByText('HSB Adjustments')).toBeInTheDocument();
    });
  });

  it('renders OFF Normal, OFF Hover, OFF Active HsbPanels', async () => {
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(screen.getByText('OFF Normal')).toBeInTheDocument();
    });

    expect(screen.getByText('OFF Hover')).toBeInTheDocument();
    expect(screen.getByText('OFF Active')).toBeInTheDocument();
  });

  it('shows ON panels only when toggle is enabled', async () => {
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(screen.getByText('Crop & Preview')).toBeInTheDocument();
    });

    // ON panels should NOT be visible initially
    expect(screen.queryByText('ON Normal')).not.toBeInTheDocument();

    // Enable toggle
    fireEvent.click(screen.getByLabelText('Generate ON/OFF toggle variant'));

    // ON panels should now be visible
    expect(screen.getByText('ON Normal')).toBeInTheDocument();
    expect(screen.getByText('ON Hover')).toBeInTheDocument();
    expect(screen.getByText('ON Active')).toBeInTheDocument();
  });

  it('renders the Reset HSB button', async () => {
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(screen.getByText('Reset HSB')).toBeInTheDocument();
    });
  });

  it('forwards HSB adjustments to preview on slider change', async () => {
    mockInvoke.mockImplementation((cmd: string, _args: any) => {
      if (cmd === 'detect_reaper_path') return Promise.resolve({ path: '/mock/reaper', method: 'Native' });
      if (cmd === 'preview_icon') return Promise.resolve([]);
      if (cmd === 'list_installed_icons') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Icon File'));

    // Wait for the crop-debounce to settle and preview to be called with defaults
    await waitFor(() => {
      const previewCalls = mockInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'preview_icon',
      );
      expect(previewCalls.length).toBeGreaterThanOrEqual(1);
      expect(previewCalls[previewCalls.length - 1][1].offAdjustments[0].hue_shift).toBe(0);
    }, { timeout: 3000 });

    // The first slider in the DOM is the PADDING slider (value starts at 2).
    // HSB sliders follow: 3 panels × 3 sliders = 9 sliders.
    // OFF Normal H slider is at index 1.
    const allSliders = screen.getAllByRole('slider');
    const hsbHSLider = allSliders[1];
    expect(hsbHSLider).toHaveValue('0');

    // Now change the H slider
    fireEvent.change(hsbHSLider, { target: { value: '45' } });

    // Verify the slider value updated in the DOM
    expect(hsbHSLider).toHaveValue('45');

    // Wait for the HSB-debounce to trigger a second preview call with adjusted HSB
    await waitFor(() => {
      const previewCalls = mockInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'preview_icon',
      );
      expect(previewCalls.length).toBeGreaterThanOrEqual(2);
      const lastCall = previewCalls[previewCalls.length - 1];
      expect(lastCall[1].offAdjustments[0].hue_shift).toBe(45);
    }, { timeout: 3000 });
  });

  it('renders OFF panels with correct labels', async () => {
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });
    mockOpen.mockResolvedValue('/mock/icons/source.png');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Icon File'));

    await waitFor(() => {
      expect(screen.getByText('OFF Normal')).toBeInTheDocument();
      expect(screen.getByText('OFF Hover')).toBeInTheDocument();
      expect(screen.getByText('OFF Active')).toBeInTheDocument();
    });
  });
});
