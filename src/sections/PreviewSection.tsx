import { useDebounce } from '../hooks/useDebounce';
import { useIconPreview } from '../hooks/useIconPreview';
import type { CropArea, HsbAdjustment } from '../api';
import StatePreview from '../StatePreview';
import HsbSection from './HsbSection';

interface Props {
  selectedFile: string | null;
  crop: CropArea | null;
  padding: number;
  isToggle: boolean;
  viewMode: 'states' | 'strips';
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onPaddingChange: (p: number) => void;
  onToggleChange: (t: boolean) => void;
  onViewModeChange: (m: 'states' | 'strips') => void;
  updateOff: (index: 0 | 1 | 2, adj: HsbAdjustment) => void;
  updateOn: (index: 0 | 1 | 2, adj: HsbAdjustment) => void;
  resetAll: () => void;
}

export default function PreviewSection({
  selectedFile,
  crop,
  padding,
  isToggle,
  viewMode,
  offAdjustments,
  onAdjustments,
  onPaddingChange,
  onToggleChange,
  onViewModeChange,
  updateOff,
  updateOn,
  resetAll,
}: Props) {
  // Debounce preview params
  const debouncedCrop = useDebounce(crop, 300);
  const debouncedPadding = useDebounce(padding, 300);
  const debouncedIsToggle = useDebounce(isToggle, 300);
  const debouncedOffAdjustments = useDebounce(offAdjustments, 300);
  const debouncedOnAdjustments = useDebounce(onAdjustments, 300);

  // Preview hook — generates preview on debounced changes
  const { previewResults, previewError } = useIconPreview(
    selectedFile,
    debouncedCrop,
    debouncedPadding,
    debouncedIsToggle,
    debouncedOffAdjustments,
    debouncedOnAdjustments,
  );

  return (
    <section className="section" id="preview-section">
      <h2>Crop &amp; Preview</h2>

      <StatePreview
        previewResults={previewResults}
        padding={padding}
        isToggle={isToggle}
        error={previewError}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      {/* Padding slider */}
      <div className="padding-slider">
        <label className="padding-slider-label">
          Padding: <strong>{padding}px</strong>
        </label>
        <div className="padding-slider-controls">
          <input
            type="range"
            min={0}
            max={4}
            step={1}
            value={padding}
            onChange={(e) => onPaddingChange(Number(e.target.value))}
            className="padding-range"
          />
          <div className="padding-marks">
            <span>0</span>
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
          </div>
        </div>
      </div>

      {/* Toggle checkbox */}
      <div className="toggle-control">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={isToggle}
            onChange={(e) => onToggleChange(e.target.checked)}
          />
          Generate ON/OFF toggle variant
        </label>
      </div>

      {/* HSB Adjustments */}
      <HsbSection
        offAdjustments={offAdjustments}
        onAdjustments={onAdjustments}
        isToggle={isToggle}
        updateOff={updateOff}
        updateOn={updateOn}
        resetAll={resetAll}
      />
    </section>
  );
}
