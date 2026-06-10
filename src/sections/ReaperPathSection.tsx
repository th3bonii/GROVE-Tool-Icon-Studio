import type { DetectionResult } from '../api';

interface Props {
  reaperPath: DetectionResult | null;
  onSelectReaperDir: () => void;
}

export default function ReaperPathSection({ reaperPath, onSelectReaperDir }: Props) {
  return (
    <section className="section" id="reaper-path-section">
      <h2>REAPER Resource Path</h2>
      {reaperPath ? (
        <>
          <div className="path-display">
            <span className={`badge badge--${reaperPath.method.toLowerCase()}`}>
              {reaperPath.method}
            </span>
            <code>{reaperPath.path ?? 'Not detected'}</code>
            {reaperPath.method === 'Manual' && !reaperPath.path && (
              <button id="btn-select-reaper" onClick={onSelectReaperDir}>
                Select Folder
              </button>
            )}
            {reaperPath.path && (
              <button
                id="btn-change-reaper"
                className="btn--secondary"
                onClick={onSelectReaperDir}
              >
                Change
              </button>
            )}
          </div>
          {reaperPath.path && (
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-text-muted)',
                margin: '0.25rem 0 0 0',
              }}
            >
              {reaperPath.path}/Data/toolbar_icons/
            </p>
          )}
        </>
      ) : (
        <p>Detecting…</p>
      )}
    </section>
  );
}
