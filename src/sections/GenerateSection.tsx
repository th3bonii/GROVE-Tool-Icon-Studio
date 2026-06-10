import { useCallback, useEffect } from 'react';
import { useIconProcessing } from '../hooks/useIconProcessing';
import type { CropArea, HsbAdjustment, DetectionResult } from '../api';

interface Props {
  selectedFile: string | null;
  reaperPath: DetectionResult | null;
  crop: CropArea | null;
  padding: number;
  isToggle: boolean;
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
}

export default function GenerateSection({
  selectedFile,
  reaperPath,
  crop,
  padding,
  isToggle,
  offAdjustments,
  onAdjustments,
}: Props) {
  const {
    processing,
    processResults,
    error,
    setProcessResults,
    setError,
    handleGenerate,
  } = useIconProcessing();

  // Reset results when selectedFile changes (mirrors original handleSelectFile behavior)
  useEffect(() => {
    setProcessResults(null);
    setError(null);
  }, [selectedFile]);

  const handleGenerateClick = useCallback(async () => {
    if (!selectedFile || !reaperPath?.path || !crop) return;
    const installDir = `${reaperPath.path}/Data/toolbar_icons`;
    await handleGenerate(
      selectedFile,
      installDir,
      crop,
      padding,
      isToggle,
      offAdjustments,
      onAdjustments,
    );
  }, [
    selectedFile,
    reaperPath,
    crop,
    padding,
    isToggle,
    offAdjustments,
    onAdjustments,
    handleGenerate,
  ]);

  const canGenerate = !!selectedFile && !!reaperPath?.path && !!crop && !processing;
  const totalFiles = processResults ? processResults.length : 0;

  return (
    <section className="section" id="process-section">
      <button
        id="btn-process"
        className="btn--primary"
        disabled={!canGenerate}
        onClick={handleGenerateClick}
      >
        {processing ? 'Processing…' : 'Generate 3-State Icon'}
      </button>

      {error && <p className="error">{error}</p>}

      {processResults && processResults.length > 0 && (
        <div className="result">
          <p className="success">Icon generated successfully!</p>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            {totalFiles} file{totalFiles > 1 ? 's' : ''} generated across 3 scales
          </p>
          <div className="scale-summary">
            {[30, 45, 60].map((scale) => {
              const scaleResults = processResults.filter((r) => r.height === scale);
              const dirLabel =
                scale === 30
                  ? 'Data/toolbar_icons/'
                  : scale === 45
                    ? 'Data/toolbar_icons/150/'
                    : 'Data/toolbar_icons/200/';
              return (
                <div key={scale} className="scale-entry">
                  <span className="scale-size">
                    {scale}×{scale}px
                  </span>
                  <span className="scale-count">
                    {scaleResults.length} file(s)
                  </span>
                  <code className="scale-dir">{dirLabel}</code>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
