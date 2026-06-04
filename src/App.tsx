import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { detectReaperPath, processIcon, previewIcon, installIcon, listInstalledIcons } from './api';
import type { DetectionResult, CropArea, ProcessingOutput } from './api';
import ImageCropper from './ImageCropper';
import StatePreview from './StatePreview';
import InstallPanel from './InstallPanel';
import { useDebounce } from './hooks/useDebounce';
import './App.css';

function App() {
  const [reaperPath, setReaperPath] = useState<DetectionResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [stateSize, setStateSize] = useState<30 | 38>(30);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [installEnabled, setInstallEnabled] = useState(false);
  const [iconName, setIconName] = useState('');
  const [installedIcons, setInstalledIcons] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debouncedCrop = useDebounce(crop, 300);
  const debouncedStateSize = useDebounce(stateSize, 300);

  // Auto-detect REAPER path on launch
  useEffect(() => {
    detectReaperPath()
      .then(setReaperPath)
      .catch((err) => setError(`Path detection failed: ${err}`));
  }, []);

  // List installed icons when reaperPath resolves
  useEffect(() => {
    if (reaperPath?.path) {
      listInstalledIcons(reaperPath.path)
        .then(setInstalledIcons)
        .catch(() => { /* silently ignore */ });
    }
  }, [reaperPath]);

  // Debounced preview: call previewIcon when crop or stateSize changes
  useEffect(() => {
    if (!selectedFile || !debouncedCrop) return;

    let cancelled = false;
    previewIcon(selectedFile, debouncedCrop, debouncedStateSize)
      .then((res) => {
        if (!cancelled) {
          setPreviewBase64(res.preview_base64);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewBase64(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile, debouncedCrop, debouncedStateSize]);

  const handleSelectFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    });
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
      setPreviewBase64(null);
      setCrop(null);
      const assetUrl = convertFileSrc(file);
      setImageSrc(assetUrl);
    }
  }, []);

  const handleSelectReaperDir = useCallback(async () => {
    const dir = await open({ directory: true, multiple: false });
    if (dir) {
      setReaperPath({ path: dir, method: 'Manual' });
      setError(null);
    }
  }, []);

  // Full pipeline: process + optionally install
  const runPipeline = useCallback(
    async (extraInstallName?: string) => {
      if (!selectedFile || !reaperPath?.path || !crop) return;

      setProcessing(true);
      setError(null);
      setResult(null);

      try {
        const res = await processIcon(selectedFile, reaperPath.path, crop, stateSize);
        setResult(res);

        // Install if enabled (either via checkbox or explicit Install button)
        const nameToInstall = extraInstallName ?? (installEnabled ? iconName : '');
        if (nameToInstall && res.output_path) {
          await installIcon(res.output_path, reaperPath.path, nameToInstall);
          // Refresh installed icons
          const icons = await listInstalledIcons(reaperPath.path);
          setInstalledIcons(icons);
        }
      } catch (err) {
        setError(`Processing failed: ${err}`);
      } finally {
        setProcessing(false);
      }
    },
    [selectedFile, reaperPath, crop, stateSize, installEnabled, iconName],
  );

  const handleGenerate = useCallback(() => runPipeline(), [runPipeline]);

  const handleInstallAction = useCallback(
    (fileName: string) => runPipeline(fileName),
    [runPipeline],
  );

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

          <StatePreview previewBase64={previewBase64} stateSize={stateSize} />

          <div className="size-selector">
            <span className="size-selector-label">State size:</span>
            <label className="size-option">
              <input
                type="radio"
                name="stateSize"
                value={30}
                checked={stateSize === 30}
                onChange={() => setStateSize(30)}
              />
              Standard (30×30)
            </label>
            <label className="size-option">
              <input
                type="radio"
                name="stateSize"
                value={38}
                checked={stateSize === 38}
                onChange={() => setStateSize(38)}
              />
              Double Width (38×38)
            </label>
          </div>
        </section>
      )}

      {/* Install to REAPER */}
      {reaperPath?.path && (
        <section className="section" id="install-section">
          <InstallPanel
            reaperPath={reaperPath.path}
            onInstall={handleInstallAction}
            installedIcons={installedIcons}
            disabled={processing || !selectedFile || !crop}
            iconName={iconName}
            installEnabled={installEnabled}
            onIconNameChange={setIconName}
            onInstallEnabledChange={setInstallEnabled}
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

        {error && <p className="error">{error}</p>}

        {result && (
          <div className="result">
            <p className="success">
              Icon generated{installEnabled && iconName ? ' and installed' : ''} successfully!
            </p>
            <dl>
              <dt>Output</dt>
              <dd>
                <code>
                  {result.output_path
                    ? result.output_path
                    : result.preview_base64
                      ? `${result.preview_base64.slice(0, 36)}…`
                      : 'N/A'}
                </code>
              </dd>
              <dt>Dimensions</dt>
              <dd>
                {result.width} × {result.height}px
              </dd>
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
