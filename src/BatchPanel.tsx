import type { BatchFile } from './hooks/useBatchProcessing';

interface BatchPanelProps {
  files: BatchFile[];
  isProcessing: boolean;
  progress: { done: number; total: number };
  onAddFiles: () => void;
  onClearFiles: () => void;
  onRemoveFile: (index: number) => void;
  onProcessAll: () => void;
  disabled: boolean;
}

function statusIcon(status: BatchFile['status']): string {
  switch (status) {
    case 'pending': return '○';
    case 'processing': return '→';
    case 'done': return '✓';
    case 'error': return '✗';
  }
}

function statusLabel(status: BatchFile['status'], error?: string): string {
  switch (status) {
    case 'pending': return 'pending';
    case 'processing': return 'processing...';
    case 'done': return 'done';
    case 'error': return error ?? 'error';
  }
}

function progressBarWidth(done: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((done / total) * 100)}%`;
}

export default function BatchPanel({
  files,
  isProcessing,
  progress,
  onAddFiles,
  onClearFiles,
  onRemoveFile,
  onProcessAll,
  disabled,
}: BatchPanelProps) {
  const hasFiles = files.length > 0;
  const processDisabled = disabled || isProcessing || !hasFiles;

  return (
    <div className="batch-panel">
      <h2 className="batch-heading">Batch Mode: ON</h2>

      {/* File list */}
      <div className="batch-file-list">
        {hasFiles ? (
          files.map((file, index) => (
            <div key={`${file.path}-${index}`} className={`batch-file-row batch-file-row--${file.status}`}>
              <span className={`batch-status-icon batch-status-icon--${file.status}`}>
                {statusIcon(file.status)}
              </span>
              <span className="batch-file-name">{file.name}</span>
              <span className={`batch-status-label batch-status-label--${file.status}`}>
                {statusLabel(file.status, file.error)}
              </span>
              {!isProcessing && (
                <button
                  className="batch-remove-btn"
                  onClick={() => onRemoveFile(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="batch-empty">No files selected.</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="batch-actions">
        <button className="batch-add-btn" onClick={onAddFiles} disabled={isProcessing}>
          + Add Files
        </button>
        <button className="batch-clear-btn" onClick={onClearFiles} disabled={isProcessing || !hasFiles}>
          Clear All
        </button>
      </div>

      {/* Progress bar */}
      <div className="batch-progress">
        <div className="batch-progress-bar">
          <div
            className="batch-progress-fill"
            style={{ width: progressBarWidth(progress.done, progress.total) }}
          />
        </div>
        <span className="batch-progress-text">
          {progress.done}/{progress.total} files
        </span>
      </div>

      {/* Process / Install */}
      <div className="batch-process-actions">
        <button
          className="batch-process-btn"
          onClick={onProcessAll}
          disabled={processDisabled}
        >
          {isProcessing ? 'Processing…' : '▶ Process All'}
        </button>
        <button className="batch-install-btn" disabled={true}>
          Install All
        </button>
      </div>
    </div>
  );
}
