import { CORNER_RADIUS_FACTOR } from './api';
import type { ProcessingOutput } from './api';

interface StatePreviewProps {
  previewResults: ProcessingOutput[];
  padding: number;
  isToggle: boolean;
  error?: string | null;
  viewMode?: 'states' | 'strips';
  onViewModeChange?: (mode: 'states' | 'strips') => void;
}

const STATE_LABELS = ['Normal', 'Hover', 'Active'];

/// Compute the corner radius matching Rust's `icon_corner_radius`.
/// Formula: `Math.max(2, Math.floor(scale * CORNER_RADIUS_FACTOR + 0.5))`,
/// then clamped to `padding` when padding > 0.
export function getCornerRadius(scale: number, padding: number): number {
  const r = Math.max(2, Math.floor(scale * CORNER_RADIUS_FACTOR + 0.5));
  return padding > 0 ? Math.min(r, padding) : r;
}

function ensureDataUri(base64: string | null): string {
  if (!base64) return '';
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

export default function StatePreview({
  previewResults,
  padding,
  isToggle,
  error,
  viewMode = 'states',
  onViewModeChange,
}: StatePreviewProps) {
  if (previewResults.length === 0) {
    return (
      <div className="state-preview-empty">
        {error ? (
          <p className="state-preview-empty-error">{error}</p>
        ) : (
          'No preview available. Select an image and adjust the crop area.'
        )}
      </div>
    );
  }

  // Group results by scale (strip height = scale size)
  const scaleMap = new Map<number, { off?: ProcessingOutput; on?: ProcessingOutput }>();
  for (const output of previewResults) {
    const scale = output.height;
    if (!scaleMap.has(scale)) scaleMap.set(scale, {});
    const group = scaleMap.get(scale)!;
    if (output.suffix === '_on') {
      group.on = output;
    } else {
      group.off = output;
    }
  }

  // Sort scales ascending
  const sortedScales = Array.from(scaleMap.entries()).sort(([a], [b]) => a - b);

  return (
    <div className="state-preview">
      {/* View mode toggle */}
      {onViewModeChange && (
        <div className="state-preview-mode-toggle">
          <button
            className={`state-preview-mode-btn${viewMode === 'states' ? ' state-preview-mode-btn--active' : ''}`}
            onClick={() => onViewModeChange('states')}
          >
            Per-State
          </button>
          <button
            className={`state-preview-mode-btn${viewMode === 'strips' ? ' state-preview-mode-btn--active' : ''}`}
            onClick={() => onViewModeChange('strips')}
          >
            Full Strip
          </button>
        </div>
      )}

      {viewMode === 'strips' ? renderStripView(sortedScales, padding, isToggle) : renderStateView(sortedScales, padding, isToggle)}
    </div>
  );
}

function renderStateView(
  sortedScales: [number, { off?: ProcessingOutput; on?: ProcessingOutput }][],
  padding: number,
  isToggle: boolean,
) {
  const offScales = sortedScales.filter(([, g]) => g.off);
  const onScales = sortedScales.filter(([, g]) => g.on && isToggle);

  return (
    <>
      {offScales.length > 0 && (
        <div className="state-preview-row">
          <span className="state-preview-row-label">OFF</span>
          <div className="state-preview-scales">
            {offScales.map(([scale, group]) => {
              const clR = getCornerRadius(scale, padding);
              const offSrc = ensureDataUri(group.off!.preview_base64 ?? null);
              return (
                <div key={scale} className="state-preview-scale-col">
                  <div className="state-preview-scale-header">
                    {scale}×{scale}px
                  </div>
                  <div
                    className="state-preview-states"
                    style={{ gap: `${Math.max(2, scale * 0.1)}px` }}
                  >
                    {STATE_LABELS.map((label, i) => (
                      <div
                        key={label}
                        className="state-icon"
                        style={{
                          width: `${scale}px`,
                          height: `${scale}px`,
                          backgroundImage: `url(${offSrc})`,
                          backgroundSize: `${scale * 3}px ${scale}px`,
                          backgroundPosition: `${-i * scale}px 0`,
                          borderRadius: `${clR}px`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onScales.length > 0 && (
        <div className="state-preview-row state-preview-row--on">
          <span className="state-preview-row-label state-preview-row-label--on">
            ON
          </span>
          <div className="state-preview-scales">
            {onScales.map(([scale, group]) => {
              const clR = getCornerRadius(scale, padding);
              const onSrc = ensureDataUri(group.on!.preview_base64 ?? null);
              return (
                <div key={scale} className="state-preview-scale-col">
                  <div className="state-preview-scale-header">
                    {scale}×{scale}px
                  </div>
                  <div
                    className="state-preview-states"
                    style={{ gap: `${Math.max(2, scale * 0.1)}px` }}
                  >
                    {STATE_LABELS.map((label, i) => (
                      <div
                        key={label}
                        className="state-icon state-icon--on"
                        style={{
                          width: `${scale}px`,
                          height: `${scale}px`,
                          backgroundImage: `url(${onSrc})`,
                          backgroundSize: `${scale * 3}px ${scale}px`,
                          backgroundPosition: `${-i * scale}px 0`,
                          borderRadius: `${clR}px`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function renderStripView(
  sortedScales: [number, { off?: ProcessingOutput; on?: ProcessingOutput }][],
  padding: number,
  isToggle: boolean,
) {
  const offScales = sortedScales.filter(([, g]) => g.off);
  const onScales = sortedScales.filter(([, g]) => g.on && isToggle);

  return (
    <>
      {offScales.length > 0 && (
        <div className="state-preview-row">
          <span className="state-preview-row-label">OFF</span>
          <div className="state-preview-scales">
            {offScales.map(([scale, group]) => {
              const clR = getCornerRadius(scale, padding);
              const offSrc = ensureDataUri(group.off!.preview_base64 ?? null);
              return (
                <div key={scale} className="state-preview-scale-col">
                  <div className="state-preview-scale-header">
                    {scale}×{scale} strip
                  </div>
                  <div className="state-preview-strip-container">
                    <img
                      className="state-preview-strip"
                      src={offSrc}
                      alt={`${scale}px OFF strip`}
                      style={{
                        width: `${scale * 3}px`,
                        height: `${scale}px`,
                        borderRadius: `${clR}px`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onScales.length > 0 && (
        <div className="state-preview-row state-preview-row--on">
          <span className="state-preview-row-label state-preview-row-label--on">
            ON
          </span>
          <div className="state-preview-scales">
            {onScales.map(([scale, group]) => {
              const clR = getCornerRadius(scale, padding);
              const onSrc = ensureDataUri(group.on!.preview_base64 ?? null);
              return (
                <div key={scale} className="state-preview-scale-col">
                  <div className="state-preview-scale-header">
                    {scale}×{scale} strip
                  </div>
                  <div className="state-preview-strip-container">
                    <img
                      className="state-preview-strip state-preview-strip--on"
                      src={onSrc}
                      alt={`${scale}px ON strip`}
                      style={{
                        width: `${scale * 3}px`,
                        height: `${scale}px`,
                        borderRadius: `${clR}px`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
