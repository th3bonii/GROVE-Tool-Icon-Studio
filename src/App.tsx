import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CropArea } from './api';
import ImageCropper from './ImageCropper';
import StatePreview from './StatePreview';
import HsbPanel from './HsbPanel';
import InstallPanel from './InstallPanel';
import BatchPanel from './BatchPanel';
import { useDebounce } from './hooks/useDebounce';
import { useReaperPath } from './hooks/useReaperPath';
import { useIconPreview } from './hooks/useIconPreview';
import { useIconProcessing } from './hooks/useIconProcessing';
import { useIconInstall } from './hooks/useIconInstall';
import { useHsbAdjustments } from './hooks/useHsbAdjustments';
import { useBatchProcessing } from './hooks/useBatchProcessing';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [padding, setPadding] = useState(2);
  const [isToggle, setIsToggle] = useState(false);
  const [viewMode, setViewMode] = useState<'states' | 'strips'>('states');
  const [batchMode, setBatchMode] = useState(false);

  // HSB adjustment state
  const { offAdjustments, onAdjustments, updateOff, updateOn, resetAll } = useHsbAdjustments();

  // Hook 1: REAPER path detection + installed icons
  const { reaperPath, installedIcons, setInstalledIcons, handleSelectReaperDir } = useReaperPath();

  // Debounce crop, padding, isToggle for preview
  const debouncedCrop = useDebounce(crop, 300);
  const debouncedPadding = useDebounce(padding, 300);
  const debouncedIsToggle = useDebounce(isToggle, 300);

  // Debounce HSB adjustments for preview
  const debouncedOffAdjustments = useDebounce(offAdjustments, 300);
  const debouncedOnAdjustments = useDebounce(onAdjustments, 300);

  // Hook 2: Preview with cancel + error surfacing
  const { previewResults, previewError, setPreviewResults } = useIconPreview(
    selectedFile,
    debouncedCrop,
    debouncedPadding,
    debouncedIsToggle,
    debouncedOffAdjustments,
    debouncedOnAdjustments,
  );

  // Hook 3: Processing state + error
  const { processing, processResults, error: processError, setProcessResults, setError: setProcessError, handleGenerate: processAndGenerate } = useIconProcessing();

  // State for installed icon preview
  const [previewStrip, setPreviewStrip] = useState<string | null>(null);
  const [previewIconName, setPreviewIconName] = useState<string | null>(null);

  // Hook 5: Batch processing state
  const {
    files: batchFiles,
    addFiles: batchAddFiles,
    clearFiles: batchClearFiles,
    removeFile: batchRemoveFile,
    isProcessing: batchProcessing,
    progress: batchProgress,
    processAll: batchProcessAll,
  } = useBatchProcessing();

  // Hook 4: Install state + handlers
  const { installEnabled, setInstallEnabled, iconName, setIconName, handleInstallAction, handleAutoInstall, handleDeleteIcon, handleExportIcon, handleGetStrip } = useIconInstall(
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

    await processAndGenerate(selectedFile, reaperPath.path, crop, padding, isToggle, offAdjustments, onAdjustments);

    if (installEnabled && iconName.trim()) {
      await handleAutoInstall(selectedFile, reaperPath.path, crop, padding, isToggle, offAdjustments, onAdjustments);
    }
  }, [selectedFile, reaperPath, crop, padding, isToggle, installEnabled, iconName, offAdjustments, onAdjustments, processAndGenerate, handleAutoInstall]);

  // Install action from InstallPanel (adapted to hook interface)
  const handleInstall = useCallback(async (fileName: string) => {
    if (!selectedFile || !reaperPath?.path || !crop) return;
    await handleInstallAction(selectedFile, crop, padding, isToggle, fileName, offAdjustments, onAdjustments);
  }, [selectedFile, reaperPath, crop, padding, isToggle, offAdjustments, onAdjustments, handleInstallAction]);

  // Batch file selector (multi-file)
  const handleBatchAddFiles = useCallback(async () => {
    const files = await open({
      multiple: true,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    });
    if (files) {
      const fileList = Array.isArray(files) ? files : [files];
      batchAddFiles(fileList);
      // Set the first file as selectedFile for preview
      if (fileList.length > 0) {
        setSelectedFile(fileList[0]);
        setImageSrc(convertFileSrc(fileList[0]));
      }
    }
  }, [batchAddFiles]);

  // Batch process all files with current settings
  const handleBatchProcessAll = useCallback(async () => {
    await batchProcessAll(crop, padding, isToggle, offAdjustments, onAdjustments);
  }, [batchProcessAll, crop, padding, isToggle, offAdjustments, onAdjustments]);

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
        <div className="section-header-row">
          <h2>Source Icon</h2>
          <label className="batch-toggle-label">
            <input
              type="checkbox"
              className="batch-toggle-input"
              checked={batchMode}
              onChange={(e) => setBatchMode(e.target.checked)}
              aria-label="Batch mode"
            />
            <span className="batch-toggle-switch" />
            <span className="batch-toggle-text">Batch</span>
          </label>
        </div>

        {batchMode ? (
          <BatchPanel
            files={batchFiles}
            isProcessing={batchProcessing}
            progress={batchProgress}
            onAddFiles={handleBatchAddFiles}
            onClearFiles={batchClearFiles}
            onRemoveFile={batchRemoveFile}
            onProcessAll={handleBatchProcessAll}
            disabled={!crop}
          />
        ) : (
          <>
            <button id="btn-select-icon" onClick={handleSelectFile}>
              {selectedFile ? 'Change Icon' : 'Select Icon File'}
            </button>
            {selectedFile && <code className="file-path">{selectedFile}</code>}
          </>
        )}

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
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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

          {/* HSB Adjustments */}
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
            onDelete={handleDeleteIcon}
            onExport={handleExportIcon}
            onPreview={async (name: string) => {
              const b64 = await handleGetStrip(name);
              if (b64) {
                setPreviewStrip(b64);
                setPreviewIconName(name);
              }
              return b64;
            }}
            previewStrip={previewStrip}
            previewIconName={previewIconName}
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
