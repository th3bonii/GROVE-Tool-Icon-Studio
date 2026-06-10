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

/// Cap per-state display width so 3 states + gaps fit the preview area (~520px).
const MAX_STATE_DISPLAY = 150;
/// Cap strip display width to fit within the preview area.
const MAX_STRIP_DISPLAY = 500;

/// Compute the corner radius matching Rust's `icon_corner_radius`.
/// Formula: `Math.max(2, Math.floor(scale * CORNER_RADIUS_FACTOR + 0.5))`,
/// then clamped to `padding` when padding > 0.
export function getCornerRadius(scale: number, padding: number): number {
  const r = Math.max(2, Math.floor(scale * CORNER_RADIUS_FACTOR + 0.5));
  return padding > 0 ? Math.min(r, padding) : r;
}

const STATE_LABELS = ['Normal', 'Hover', 'Active'];

/// Compute a per-state display scale that never exceeds MAX_STATE_DISPLAY per state.
function getDisplayScale(scaleNum: number): number {
  const computed = Math.floor(MAX_STATE_DISPLAY / scaleNum);
  return Math.max(1, Math.min(2, computed));
}

/// Compute a strip display scale that never exceeds MAX_STRIP_DISPLAY total width.
function getStripScale(scaleNum: number): number {
  const stripWidth = scaleNum * 3;
  const computed = Math.floor(MAX_STRIP_DISPLAY / stripWidth * 10) / 10;
  return Math.max(0.5, Math.min(1.5, computed));
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
  return (
    <>
      {sortedScales.map(([scale, group]) => {
        const clR = getCornerRadius(scale, padding);
        const dispR = clR * getDisplayScale(scale);
        const offSrc = ensureDataUri(group.off?.preview_base64 ?? null);
        const onSrc = ensureDataUri(group.on?.preview_base64 ?? null);

        return (
          <div key={scale} className="state-preview-scale">
            <div className="state-preview-scale-header">
              {scale}×{scale}px (padding: {padding}px)
              {' '}
              {getDisplayScale(scale) === 1 && <span className="state-preview-size-note">(actual size)</span>}
              {getDisplayScale(scale) === 2 && <span className="state-preview-size-note">(2× zoom)</span>}
            </div>

            {/* OFF row */}
            {group.off && (
              <div className="state-preview-row">
                <span className="state-preview-row-label">
                  OFF
                </span>
                <div
                  className="state-preview-states"
                  style={{ gap: `${scale * 0.25}px` }}
                >
                  {STATE_LABELS.map((label, i) => (
                    <div key={label} className="state-preview-state">
                      <div
                        className="state-icon"
                        style={{
                          width: `${scale * getDisplayScale(scale)}px`,
                          height: `${scale * getDisplayScale(scale)}px`,
                          backgroundImage: `url(${offSrc})`,
                          backgroundSize: `${scale * 3 * getDisplayScale(scale)}px ${scale * getDisplayScale(scale)}px`,
                          backgroundPosition: `${-i * scale * getDisplayScale(scale)}px 0`,
                          borderRadius: `${dispR}px`,
                        }}
                      />
                      <div
                        className="state-preview-state-label"
                        style={{ width: `${scale * getDisplayScale(scale)}px` }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ON row (only when toggle is enabled and ON variant exists) */}
            {isToggle && group.on && (
              <div className="state-preview-row state-preview-row--on">
                <span className="state-preview-row-label state-preview-row-label--on">
                  ON
                </span>
                <div
                  className="state-preview-states"
                  style={{ gap: `${scale * 0.25}px` }}
                >
                  {STATE_LABELS.map((label, i) => (
                    <div key={label} className="state-preview-state">
                      <div
                        className="state-icon state-icon--on"
                        style={{
                          width: `${scale * getDisplayScale(scale)}px`,
                          height: `${scale * getDisplayScale(scale)}px`,
                          backgroundImage: `url(${onSrc})`,
                          backgroundSize: `${scale * 3 * getDisplayScale(scale)}px ${scale * getDisplayScale(scale)}px`,
                          backgroundPosition: `${-i * scale * getDisplayScale(scale)}px 0`,
                          borderRadius: `${dispR}px`,
                        }}
                      />
                      <div
                        className="state-preview-state-label"
                        style={{ width: `${scale * getDisplayScale(scale)}px` }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="state-preview-dimensions">
              {scale}×{scale} each · {scale * 3}×{scale} per row
            </p>
          </div>
        );
      })}
    </>
  );
}

function renderStripView(
  sortedScales: [number, { off?: ProcessingOutput; on?: ProcessingOutput }][],
  padding: number,
  isToggle: boolean,
) {
  return (
    <>
      {sortedScales.map(([scale, group]) => {
        const clR = getCornerRadius(scale, padding);
        const dispR = clR * getStripScale(scale);
        const offSrc = ensureDataUri(group.off?.preview_base64 ?? null);
        const onSrc = ensureDataUri(group.on?.preview_base64 ?? null);
        const stripWidth = scale * 3;
        const displayW = Math.round(stripWidth * getStripScale(scale));
        const displayH = Math.round(scale * getStripScale(scale));

        return (
          <div key={scale} className="state-preview-scale">
            <div className="state-preview-scale-header">
              {scale}×{scale}px · {stripWidth}×{scale} strip · → icon.png
              {' '}
              {getDisplayScale(scale) === 1 && <span className="state-preview-size-note">(actual size)</span>}
              {getDisplayScale(scale) === 2 && <span className="state-preview-size-note">(2× zoom)</span>}
            </div>

            {/* OFF strip */}
            {group.off && (
              <div className="state-preview-row">
                <span className="state-preview-row-label">
                  OFF
                </span>
                <div className="state-preview-strip-container">
                  <img
                    className="state-preview-strip"
                    src={offSrc}
                    alt={`${scale}px OFF strip`}
                    style={{
                      width: `${displayW}px`,
                      height: `${displayH}px`,
                      borderRadius: `${dispR}px`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* ON strip (only when toggle is enabled) */}
            {isToggle && group.on && (
              <div className="state-preview-row state-preview-row--on">
                <span className="state-preview-row-label state-preview-row-label--on">
                  ON
                </span>
                <div className="state-preview-strip-container">
                  <img
                    className="state-preview-strip state-preview-strip--on"
                    src={onSrc}
                    alt={`${scale}px ON strip`}
                    style={{
                      width: `${displayW}px`,
                      height: `${displayH}px`,
                      borderRadius: `${dispR}px`,
                    }}
                  />
                </div>
              </div>
            )}

            <p className="state-preview-dimensions">
              {scale}×{scale} each · {stripWidth}×{scale} strip · → icon.png
            </p>
          </div>
        );
      })}
    </>
  );
}
