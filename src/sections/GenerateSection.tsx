import { useState, useCallback, useEffect } from 'react';
import { installIconSet, listInstalledIcons } from '../api';
import type { CropArea, HsbAdjustment, DetectionResult } from '../api';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface Props {
  selectedFile: string | null;
  reaperPath: DetectionResult | null;
  crop: CropArea | null;
  padding: number;
  isToggle: boolean;
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  installedIcons: string[];
  setInstalledIcons: (icons: string[]) => void;
}

export default function GenerateSection({
  selectedFile,
  reaperPath,
  crop,
  padding,
  isToggle,
  offAdjustments,
  onAdjustments,
  setInstalledIcons,
}: Props) {
  const [iconName, setIconName] = useLocalStorage('grove-iconName', '');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  // Reset results when selectedFile changes
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [selectedFile]);

  const handleGenerate = useCallback(async () => {
    if (!selectedFile || !reaperPath?.path || !crop) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const targetName = iconName.trim() || '';
      const res = await installIconSet(
        selectedFile,
        reaperPath.path,
        targetName,
        crop,
        padding,
        isToggle,
        offAdjustments,
        onAdjustments,
      );
      setResult(res);

      // Refresh installed icons list
      const icons = await listInstalledIcons(reaperPath.path);
      setInstalledIcons(icons);
    } catch (err) {
      setError(`Generation failed: ${err}`);
    } finally {
      setProcessing(false);
    }
  }, [
    selectedFile, reaperPath, crop, padding, isToggle,
    iconName, offAdjustments, onAdjustments, setInstalledIcons,
  ]);

  const canGenerate = !!selectedFile && !!reaperPath?.path && !!crop && !processing;
  const totalFiles = result ? result.length : 0;
  const variants = isToggle ? 2 : 1;

  return (
    <section className="section" id="process-section">
      {/* Icon name input */}
      <div className="install-field">
        <label htmlFor="gen-icon-name" className="install-field-label">
          Icon name <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id="gen-icon-name"
          type="text"
          className="install-filename-input"
          placeholder="icon-name (defaults to source filename)"
          value={iconName}
          onChange={(e) => setIconName(e.target.value)}
          disabled={processing}
        />
      </div>

      {/* Generate button */}
      <button
        id="btn-process"
        className="btn--primary"
        disabled={!canGenerate}
        onClick={handleGenerate}
      >
        {processing ? 'Generating…' : 'Generate & Install'}
      </button>

      {error && <p className="error">{error}</p>}

      {result && result.length > 0 && (
        <div className="result">
          <p className="success">Icon installed successfully!</p>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            {totalFiles} file{totalFiles > 1 ? 's' : ''} generated across 3 scale{variants > 1 ? ` × ${variants} variants` : ''}
          </p>
        </div>
      )}
    </section>
  );
}
