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

// Mock ImageCropper to auto-set a default crop (needed for Process All button)
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

describe('App with Batch Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ path: '/mock/reaper', method: 'Native' });
  });

  it('renders batch mode toggle in the Source Icon section', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    // Should show a batch mode toggle
    expect(screen.getByLabelText(/Batch mode/i)).toBeInTheDocument();
  });

  it('shows single file mode by default', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    // In single mode, the Select Icon File button should be visible
    expect(screen.getByText('Select Icon File')).toBeInTheDocument();
    // BatchPanel should NOT be visible in single mode
    expect(screen.queryByText('Batch Mode: ON')).not.toBeInTheDocument();
  });

  it('shows BatchPanel when batch mode is toggled on', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    // Toggle batch mode on
    fireEvent.click(screen.getByLabelText(/Batch mode/i));

    // Batch panel should now be visible
    expect(screen.getByText('Batch Mode: ON')).toBeInTheDocument();
    // Single file button should NOT be visible
    expect(screen.queryByText('Select Icon File')).not.toBeInTheDocument();
  });

  it('toggles back to single mode when batch toggle is clicked again', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    // Toggle batch mode on
    fireEvent.click(screen.getByLabelText(/Batch mode/i));
    expect(screen.getByText('Batch Mode: ON')).toBeInTheDocument();

    // Toggle back off
    fireEvent.click(screen.getByLabelText(/Batch mode/i));

    expect(screen.queryByText('Batch Mode: ON')).not.toBeInTheDocument();
    expect(screen.getByText('Select Icon File')).toBeInTheDocument();
  });

  it('opens multi-file dialog when Add Files is clicked in batch mode', async () => {
    // Mock multi-file return
    mockOpen.mockResolvedValue(['/path/mute.png', '/path/solo.png']);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    // Toggle batch mode on
    fireEvent.click(screen.getByLabelText(/Batch mode/i));

    // Find Add Files button
    const addBtn = screen.getByText('+ Add Files');
    expect(addBtn).toBeInTheDocument();

    // Click Add Files
    fireEvent.click(addBtn);

    await waitFor(() => {
      // Should show the files in the batch panel
      expect(screen.getByText('mute')).toBeInTheDocument();
      expect(screen.getByText('solo')).toBeInTheDocument();
    });

    // Verify the dialog was called with multiple: true
    expect(mockOpen).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: true }),
    );
  });

  it('sets first batch file as selected file for preview', async () => {
    mockOpen.mockResolvedValue(['/path/mute.png', '/path/solo.png']);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    // Toggle batch mode on
    fireEvent.click(screen.getByLabelText(/Batch mode/i));

    // Click Add Files
    fireEvent.click(screen.getByText('+ Add Files'));

    await waitFor(() => {
      // First file should be selected for preview (mute)
      expect(screen.getByText('mute')).toBeInTheDocument();
      // The crop section should show for the first file
      expect(screen.getByText('Crop & Preview')).toBeInTheDocument();
    });
  });

  it('processes all files when Process All is clicked', async () => {
    mockOpen.mockResolvedValue(['/path/mute.png', '/path/solo.png']);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'detect_reaper_path') return Promise.resolve({ path: '/mock/reaper', method: 'Native' });
      if (cmd === 'list_installed_icons') return Promise.resolve([]);
      if (cmd === 'preview_icon') return Promise.resolve([{ width: 32, height: 32, output_path: null, preview_base64: 'data:', suffix: '' }]);
      return Promise.resolve([]);
    });

    render(<App />);

    // Wait for REAPER detection
    await waitFor(() => {
      expect(screen.getByText('Native')).toBeInTheDocument();
    });

    // Toggle batch mode on
    fireEvent.click(screen.getByLabelText(/Batch mode/i));

    // Add files (mockInvoke will handle preview_icon calls)
    fireEvent.click(screen.getByText('+ Add Files'));

    // Wait for the crop to be set (via ImageCropper mock) and files to appear
    await waitFor(() => {
      expect(screen.getByText('mute')).toBeInTheDocument();
    });

    // Find Process All button
    const buttons = screen.getAllByRole('button');
    const processBtn = buttons.find((btn) => btn.textContent?.includes('Process All'));
    expect(processBtn).toBeTruthy();
    expect((processBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(processBtn!);

    // Wait for processing to complete
    await waitFor(() => {
      expect(screen.getByText('2/2 files')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Both files should show done status
    const doneLabels = screen.getAllByText('done');
    expect(doneLabels).toHaveLength(2);
  });
});
