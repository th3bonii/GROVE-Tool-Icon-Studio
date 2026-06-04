interface StatePreviewProps {
  previewBase64: string | null;
  stateSize: 30 | 38;
}

const DISPLAY_SCALE = 3;

const labelStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '0.75rem',
  color: 'var(--color-text-muted, #8899aa)',
  marginTop: '4px',
};

export default function StatePreview({
  previewBase64,
  stateSize,
}: StatePreviewProps) {
  if (!previewBase64) {
    return (
      <div
        className="state-preview-empty"
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--color-text-muted, #8899aa)',
          border: '1px dashed var(--color-border, #0f3460)',
          borderRadius: '8px',
        }}
      >
        No preview available. Select an image and adjust the crop area.
      </div>
    );
  }

  const totalWidth = stateSize * 3 * DISPLAY_SCALE;
  const totalHeight = stateSize * DISPLAY_SCALE;

  return (
    <div className="state-preview">
      <div
        className="state-preview-image"
        style={{ textAlign: 'center', marginBottom: '0.5rem' }}
      >
        <img
          src={previewBase64}
          alt="3-state icon preview"
          style={{
            width: `${totalWidth}px`,
            height: `${totalHeight}px`,
            imageRendering: 'pixelated',
            borderRadius: '4px',
            border: '1px solid var(--color-border, #0f3460)',
          }}
        />
      </div>

      <div
        className="state-preview-labels"
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: `${stateSize * DISPLAY_SCALE}px`,
          marginBottom: '0.25rem',
        }}
      >
        <div style={{ ...labelStyle, width: `${stateSize * DISPLAY_SCALE}px` }}>
          Normal
        </div>
        <div style={{ ...labelStyle, width: `${stateSize * DISPLAY_SCALE}px` }}>
          Hover
        </div>
        <div style={{ ...labelStyle, width: `${stateSize * DISPLAY_SCALE}px` }}>
          Click
        </div>
      </div>

      <p
        className="state-preview-dimensions"
        style={{
          textAlign: 'center',
          fontSize: '0.7rem',
          color: 'var(--color-text-muted, #8899aa)',
        }}
      >
        {stateSize}×{stateSize} each · {stateSize * 3}×{stateSize} total
      </p>
    </div>
  );
}
