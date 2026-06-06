import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CropArea } from './api';
import ImageCropper from './ImageCropper';
import StatePreview from './StatePreview';
import InstallPanel from './InstallPanel';
import { useDebounce } from './hooks/useDebounce';
import { useReaperPath } from './hooks/useReaperPath';
import { useIconPreview } from './hooks/useIconPreview';
import { useIconProcessing } from './hooks/useIconProcessing';
import { useIconInstall } from './hooks/useIconInstall';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [padding, setPadding] = useState(2);
  const [isToggle, setIsToggle] = useState(false);

  // Hook 1: REAPER path detection + installed icons
  const { reaperPath, installedIcons, setInstalledIcons, handleSelectReaperDir } = useReaperPath();

  // Debounce crop, padding, isToggle for preview
  const debouncedCrop = useDebounce(crop, 300);
  const debouncedPadding = useDebounce(padding, 300);
  const debouncedIsToggle = useDebounce(isToggle, 300);

  // Hook 2: Preview with cancel + error surfacing
  const { previewResults, previewError, setPreviewResults } = useIconPreview(
    selectedFile,
    debouncedCrop,
    debouncedPadding,
    debouncedIsToggle,
  );

  // Hook 3: Processing state + error
  const { processing, processResults, error: processError, setProcessResults, setError: setProcessError, handleGenerate: processAndGenerate } = useIconProcessing();

  // Hook 4: Install state + handlers
  const { installEnabled, setInstallEnabled, iconName, setIconName, handleInstallAction, handleAutoInstall } = useIconInstall(
    reaperPath?.path ?? null,
    setInstalledIcons,
  );

  const handleSelectFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    });
    if (file) {
      setSelectedFile(file);
      setProcessResults(null);
      setProcessError(null);
      setPreviewResults([]);
      setCrop(null);
      const assetUrl = convertFileSrc(file);
      setImageSrc(assetUrl);
    }
  }, [setProcessResults, setProcessError, setPreviewResults]);

  // Generate: process icon then optionally auto-install
  const handleGenerate = useCallback(async () => {
    if (!selectedFile || !reaperPath?.path || !crop) return;

    await processAndGenerate(selectedFile, reaperPath.path, crop, padding, isToggle);

    if (installEnabled && iconName.trim()) {
      await handleAutoInstall(selectedFile, reaperPath.path, crop, padding, isToggle);
    }
  }, [selectedFile, reaperPath, crop, padding, isToggle, installEnabled, iconName, processAndGenerate, handleAutoInstall]);

  // Install action from InstallPanel (adapted to hook interface)
  const handleInstall = useCallback(async (fileName: string) => {
    if (!selectedFile || !reaperPath?.path || !crop) return;
    await handleInstallAction(selectedFile, crop, padding, isToggle, fileName);
  }, [selectedFile, reaperPath, crop, padding, isToggle, handleInstallAction]);

  const totalFiles = processResults ? processResults.length : 0;
  const canGenerate = !!selectedFile && !!reaperPath?.path && !!crop && !processing;

  return (
    <div className="container">
      <header className="header">
        <h1>GROVE Icon Studio</h1>
        <p className="subtitle">REAPER 3-State Toolbar Icon Generator</p>
      </header>

      {/* REAPER Resource Path */}
      <section className="section" id="reaper-path-section">
        <h2>REAPER Resource Path</h2>
        {reaperPath ? (
          <div className="path-display">
            <span className={`badge badge--${reaperPath.method.toLowerCase()}`}>
              {reaperPath.method}
            </span>
            <code>{reaperPath.path ?? 'Not detected'}</code>
            {reaperPath.method === 'Manual' && !reaperPath.path && (
              <button id="btn-select-reaper" onClick={handleSelectReaperDir}>
                Select Folder
              </button>
            )}
            {reaperPath.path && (
              <button
                id="btn-change-reaper"
                className="btn--secondary"
                onClick={handleSelectReaperDir}
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <p>Detecting…</p>
        )}
      </section>

      {/* Source Icon */}
      <section className="section" id="icon-input-section">
        <h2>Source Icon</h2>
        <button id="btn-select-icon" onClick={handleSelectFile}>
          {selectedFile ? 'Change Icon' : 'Select Icon File'}
        </button>
        {selectedFile && <code className="file-path">{selectedFile}</code>}

        {imageSrc && (
          <div className="cropper-section">
            <ImageCropper imageSrc={imageSrc} onCropChange={setCrop} />
          </div>
        )}
      </section>

      {/* Crop & Preview (shown once a file is selected) */}
      {selectedFile && (
        <section className="section" id="preview-section">
          <h2>Crop &amp; Preview</h2>

          <StatePreview
            previewResults={previewResults}
            padding={padding}
            isToggle={isToggle}
            error={previewError}
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
                onChange={(e) => setPadding(Number(e.target.value))}
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
                onChange={(e) => setIsToggle(e.target.checked)}
              />
              Generate ON/OFF toggle variant
            </label>
          </div>
        </section>
      )}

      {/* Install to REAPER */}
      {reaperPath?.path && (
        <section className="section" id="install-section">
          <InstallPanel
            reaperPath={reaperPath.path}
            onInstall={handleInstall}
            installedIcons={installedIcons}
            disabled={processing || !selectedFile || !crop}
            iconName={iconName}
            installEnabled={installEnabled}
            onIconNameChange={setIconName}
            onInstallEnabledChange={setInstallEnabled}
            isToggle={isToggle}
          />
        </section>
      )}

      {/* Generate */}
      <section className="section" id="process-section">
        <button
          id="btn-process"
          className="btn--primary"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {processing ? 'Processing…' : 'Generate 3-State Icon'}
        </button>

        {processError && <p className="error">{processError}</p>}

        {processResults && processResults.length > 0 && (
          <div className="result">
            <p className="success">
              Icon generated{installEnabled && iconName ? ' and installed' : ''} successfully!
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
              {totalFiles} file{totalFiles > 1 ? 's' : ''} generated across 3 scales
            </p>
            <div className="scale-summary">
              {[30, 45, 60].map((scale) => {
                const scaleResults = processResults.filter((r) => r.height === scale);
                const dirLabel =
                  scale === 30
                    ? 'toolbar_icons/'
                    : scale === 45
                      ? 'toolbar_icons/150/'
                      : 'toolbar_icons/200/';
                return (
                  <div key={scale} className="scale-entry">
                    <span className="scale-size">{scale}×{scale}px</span>
                    <span className="scale-count">{scaleResults.length} file(s)</span>
                    <code className="scale-dir">{dirLabel}</code>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
