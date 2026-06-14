import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CropArea, HsbAdjustment, DetectionResult } from '../api';
import { useBatchProcessing } from '../hooks/useBatchProcessing';
import ImageCropper from '../ImageCropper';
import BatchPanel from '../BatchPanel';

interface Props {
  selectedFile: string | null;
  imageSrc: string | null;
  crop: CropArea | null;
  batchMode: boolean;
  padding: number;
  isToggle: boolean;
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  reaperPath: DetectionResult | null;
  onSelectFile: () => void;
  onCropChange: (crop: CropArea | null) => void;
  onBatchModeChange: (enabled: boolean) => void;
  onFirstBatchFile: (file: string, src: string) => void;
}

export default function SourceSection({
  selectedFile,
  imageSrc,
  crop,
  batchMode,
  padding,
  isToggle,
  offAdjustments,
  onAdjustments,
  reaperPath,
  onSelectFile,
  onCropChange,
  onBatchModeChange,
  onFirstBatchFile,
}: Props) {
  const {
    files: batchFiles,
    addFiles: batchAddFiles,
    clearFiles: batchClearFiles,
    removeFile: batchRemoveFile,
    isProcessing: batchProcessing,
    progress: batchProgress,
    processAll: batchProcessAll,
  } = useBatchProcessing();

  // Batch file handler — opens dialog internally
  const handleBatchAddFiles = useCallback(async () => {
    const files = await open({
      multiple: true,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    });
    if (files) {
      const fileList = Array.isArray(files) ? files : [files];
      batchAddFiles(fileList);
      if (fileList.length > 0) {
        onFirstBatchFile(fileList[0], convertFileSrc(fileList[0]));
      }
    }
  }, [batchAddFiles, onFirstBatchFile]);

  // Batch process all files with current settings
  const handleBatchProcessAll = useCallback(async () => {
    await batchProcessAll(crop, padding, isToggle, offAdjustments, onAdjustments, reaperPath?.path);
  }, [batchProcessAll, crop, padding, isToggle, offAdjustments, onAdjustments, reaperPath]);

  return (
    <section className="section" id="icon-input-section">
      <div className="section-header-row">
        <h2>Source Icon</h2>
        <label className="batch-toggle-label">
          <input
            type="checkbox"
            className="batch-toggle-input"
            checked={batchMode}
            onChange={(e) => onBatchModeChange(e.target.checked)}
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
          <button id="btn-select-icon" onClick={onSelectFile}>
            {selectedFile ? 'Change Icon' : 'Select Icon File'}
          </button>
          {selectedFile && <code className="file-path">{selectedFile}</code>}
        </>
      )}

      {imageSrc && (
        <div className="cropper-section">
          <ImageCropper key={imageSrc} imageSrc={imageSrc} onCropChange={onCropChange} />
        </div>
      )}
    </section>
  );
}
