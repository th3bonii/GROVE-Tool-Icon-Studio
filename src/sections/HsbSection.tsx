import type { HsbAdjustment } from '../api';
import HsbPanel from '../HsbPanel';

interface Props {
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  isToggle: boolean;
  updateOff: (index: 0 | 1 | 2, adj: HsbAdjustment) => void;
  updateOn: (index: 0 | 1 | 2, adj: HsbAdjustment) => void;
  resetAll: () => void;
}

export default function HsbSection({
  offAdjustments,
  onAdjustments,
  isToggle,
  updateOff,
  updateOn,
  resetAll,
}: Props) {
  return (
    <div className="hsb-section">
      <h2 className="hsb-section-heading">HSB Adjustments</h2>
      <div className="hsb-grid">
        <HsbPanel
          label="OFF Normal"
          adjustment={offAdjustments[0]}
          onChange={(a) => updateOff(0, a)}
        />
        <HsbPanel
          label="OFF Hover"
          adjustment={offAdjustments[1]}
          onChange={(a) => updateOff(1, a)}
        />
        <HsbPanel
          label="OFF Active"
          adjustment={offAdjustments[2]}
          onChange={(a) => updateOff(2, a)}
        />
      </div>
      {isToggle && (
        <div className="hsb-grid hsb-grid-on">
          <HsbPanel
            label="ON Normal"
            adjustment={onAdjustments[0]}
            onChange={(a) => updateOn(0, a)}
          />
          <HsbPanel
            label="ON Hover"
            adjustment={onAdjustments[1]}
            onChange={(a) => updateOn(1, a)}
          />
          <HsbPanel
            label="ON Active"
            adjustment={onAdjustments[2]}
            onChange={(a) => updateOn(2, a)}
          />
        </div>
      )}
      <button className="hsb-reset-btn" onClick={resetAll}>
        Reset HSB
      </button>
    </div>
  );
}
