import { render, screen, fireEvent } from '@testing-library/react';
import BatchPanel from '../BatchPanel';
import type { BatchFile } from '../hooks/useBatchProcessing';
import type { ProcessingOutput } from '../api';

describe('BatchPanel', () => {
  const defaultProps = {
    files: [] as BatchFile[],
    isProcessing: false,
    progress: { done: 0, total: 0 },
    onAddFiles: vi.fn(),
    onClearFiles: vi.fn(),
    onRemoveFile: vi.fn(),
    onProcessAll: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the batch mode heading', () => {
    render(<BatchPanel {...defaultProps} />);
    expect(screen.getByText('Batch Mode: ON')).toBeInTheDocument();
  });

  it('shows empty state when no files are added', () => {
    render(<BatchPanel {...defaultProps} />);
    expect(screen.getByText('No files selected.')).toBeInTheDocument();
  });

  it('renders file list entries with correct names', () => {
    const files: BatchFile[] = [
      { path: '/path/icon_mute.png', name: 'icon_mute', status: 'pending' },
      { path: '/path/icon_solo.png', name: 'icon_solo', status: 'done', results: [] as ProcessingOutput[] },
    ];

    render(<BatchPanel {...defaultProps} files={files} />);

    expect(screen.getByText('icon_mute')).toBeInTheDocument();
    expect(screen.getByText('icon_solo')).toBeInTheDocument();
  });

  it('shows pending status icon', () => {
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'pending' },
    ];

    render(<BatchPanel {...defaultProps} files={files} />);
    expect(screen.getByText('○')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows processing status icon', () => {
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'processing' },
    ];

    render(<BatchPanel {...defaultProps} files={files} />);
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByText('processing...')).toBeInTheDocument();
  });

  it('shows done status icon', () => {
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'done', results: [] as ProcessingOutput[] },
    ];

    render(<BatchPanel {...defaultProps} files={files} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('shows error status icon and message', () => {
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'error', error: 'Processing failed: invalid image' },
    ];

    render(<BatchPanel {...defaultProps} files={files} />);
    expect(screen.getByText('✗')).toBeInTheDocument();
    expect(screen.getByText('Processing failed: invalid image')).toBeInTheDocument();
  });

  it('renders Add Files and Clear All buttons', () => {
    render(<BatchPanel {...defaultProps} />);
    expect(screen.getByText('+ Add Files')).toBeInTheDocument();
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('calls onAddFiles when Add Files button is clicked', () => {
    const onAddFiles = vi.fn();
    render(<BatchPanel {...defaultProps} onAddFiles={onAddFiles} />);

    fireEvent.click(screen.getByText('+ Add Files'));
    expect(onAddFiles).toHaveBeenCalledTimes(1);
  });

  it('calls onClearFiles when Clear All is clicked', () => {
    const onClearFiles = vi.fn();
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'pending' },
    ];
    render(<BatchPanel {...defaultProps} files={files} onClearFiles={onClearFiles} />);

    fireEvent.click(screen.getByText('Clear All'));
    expect(onClearFiles).toHaveBeenCalledTimes(1);
  });

  it('calls onRemoveFile when remove button is clicked on a file row', () => {
    const onRemoveFile = vi.fn();
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'pending' },
    ];

    render(<BatchPanel {...defaultProps} files={files} onRemoveFile={onRemoveFile} />);

    // Find and click the remove button (labeled "✕" with aria-label)
    const removeBtn = screen.getByRole('button', { name: /Remove/ });
    expect(removeBtn).toBeTruthy();
    fireEvent.click(removeBtn);
    expect(onRemoveFile).toHaveBeenCalledWith(0);
  });

  it('renders Process All and Install All buttons when files exist', () => {
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'pending' },
    ];

    render(<BatchPanel {...defaultProps} files={files} />);
    expect(screen.getByText('▶ Process All')).toBeInTheDocument();
    expect(screen.getByText('Install All')).toBeInTheDocument();
  });

  it('disables Process All when disabled prop is true', () => {
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'pending' },
    ];

    render(<BatchPanel {...defaultProps} files={files} disabled={true} />);
    // When isProcessing=false, button text is "▶ Process All"
    const processBtns = screen.getAllByRole('button');
    const processBtn = processBtns.find((btn) => btn.textContent?.includes('Process All'));
    expect(processBtn).toBeTruthy();
    expect((processBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables Process All when isProcessing is true', () => {
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'pending' },
    ];

    render(<BatchPanel {...defaultProps} files={files} isProcessing={true} />);
    // When isProcessing=true, button text is "Processing…"
    const processBtns = screen.getAllByRole('button');
    const processBtn = processBtns.find((btn) => btn.textContent?.includes('Processing'));
    expect(processBtn).toBeTruthy();
    expect((processBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onProcessAll when Process All is clicked', () => {
    const onProcessAll = vi.fn();
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'pending' },
    ];

    render(<BatchPanel {...defaultProps} files={files} onProcessAll={onProcessAll} />);

    const buttons = screen.getAllByRole('button');
    const processBtn = buttons.find((btn) => btn.textContent?.includes('Process All'));
    expect(processBtn).toBeTruthy();
    fireEvent.click(processBtn!);
    expect(onProcessAll).toHaveBeenCalledTimes(1);
  });

  it('shows progress bar with done/total count', () => {
    render(<BatchPanel {...defaultProps} progress={{ done: 3, total: 8 }} />);
    expect(screen.getByText('3/8 files')).toBeInTheDocument();
  });

  it('shows "0/0 files" when no files exist', () => {
    render(<BatchPanel {...defaultProps} progress={{ done: 0, total: 0 }} />);
    expect(screen.getByText('0/0 files')).toBeInTheDocument();
  });

  it('removes file remove buttons when isProcessing is true', () => {
    const files: BatchFile[] = [
      { path: '/path/test.png', name: 'test', status: 'processing' },
    ];

    render(<BatchPanel {...defaultProps} files={files} isProcessing={true} />);

    // Remove buttons should NOT be present during processing
    const removeBtn = screen.queryByRole('button', { name: /Remove/ });
    expect(removeBtn).toBeNull();
  });
});
