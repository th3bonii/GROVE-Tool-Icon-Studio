import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { detectReaperPath, processIcon } from './api';
import type { DetectionResult, ProcessingResult } from './api';
import './App.css';

function App() {
  const [reaperPath, setReaperPath] = useState<DetectionResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect REAPER path on launch
  useEffect(() => {
    detectReaperPath()
      .then(setReaperPath)
      .catch((err) => setError(`Path detection failed: ${err}`));
  }, []);

  const handleSelectFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    });
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleSelectReaperDir = useCallback(async () => {
    const dir = await open({ directory: true, multiple: false });
    if (dir) {
      setReaperPath({ path: dir, method: 'Manual' });
      setError(null);
    }
  }, []);

  const handleProcess = useCallback(async () => {
    if (!selectedFile || !reaperPath?.path) return;

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const res = await processIcon(selectedFile, reaperPath.path);
      setResult(res);
    } catch (err) {
      setError(`Processing failed: ${err}`);
    } finally {
      setProcessing(false);
    }
  }, [selectedFile, reaperPath]);

  return (
    <div className="container">
      <header className="header">
        <h1>GROVE Icon Studio</h1>
        <p className="subtitle">REAPER 3-State Toolbar Icon Generator</p>
      </header>

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

      <section className="section" id="icon-input-section">
        <h2>Source Icon</h2>
        <button id="btn-select-icon" onClick={handleSelectFile}>
          {selectedFile ? 'Change Icon' : 'Select Icon File'}
        </button>
        {selectedFile && <code className="file-path">{selectedFile}</code>}
      </section>

      <section className="section" id="process-section">
        <button
          id="btn-process"
          className="btn--primary"
          disabled={!selectedFile || !reaperPath?.path || processing}
          onClick={handleProcess}
        >
          {processing ? 'Processing…' : 'Generate 3-State Icon'}
        </button>

        {error && <p className="error">{error}</p>}

        {result && (
          <div className="result">
            <p className="success">Icon generated successfully!</p>
            <dl>
              <dt>Output</dt>
              <dd><code>{result.output_path}</code></dd>
              <dt>Dimensions</dt>
              <dd>{result.width} × {result.height}px</dd>
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
