import type { HsbAdjustment } from './api';

interface HsbPanelProps {
  label: string;
  adjustment: HsbAdjustment;
  onChange: (adj: HsbAdjustment) => void;
  colorAccent?: string;
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="hsb-slider-row">
      <span className="hsb-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        role="slider"
      />
      <span className="hsb-slider-value">{value}</span>
    </div>
  );
}

export default function HsbPanel({ label, adjustment, onChange }: HsbPanelProps) {
  return (
    <div className="hsb-panel">
      <div className="hsb-panel-label">{label}</div>
      <SliderRow
        label="H"
        value={adjustment.hue_shift}
        min={-180}
        max={180}
        onChange={(v) => onChange({ ...adjustment, hue_shift: v })}
      />
      <SliderRow
        label="S"
        value={adjustment.sat_delta}
        min={-100}
        max={100}
        onChange={(v) => onChange({ ...adjustment, sat_delta: v })}
      />
      <SliderRow
        label="B"
        value={adjustment.bri_delta}
        min={-100}
        max={100}
        onChange={(v) => onChange({ ...adjustment, bri_delta: v })}
      />
    </div>
  );
}
