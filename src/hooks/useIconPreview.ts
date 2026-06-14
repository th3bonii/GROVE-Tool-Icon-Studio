import { useState, useEffect } from 'react';
import { previewIcon } from '../api';
import type { CropArea, HsbAdjustment, ProcessingOutput } from '../api';

export function useIconPreview(
  selectedFile: string | null,
  debouncedCrop: CropArea | null,
  debouncedPadding: number,
  debouncedIsToggle: boolean,
  offAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
  onAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
) {
  const [previewResults, setPreviewResults] = useState<ProcessingOutput[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    // Clear results when there's no file selected
    if (!selectedFile) {
      setPreviewResults([]);
      setPreviewError(null);
      return;
    }

    // Clear results when crop is reset (e.g. new file selected)
    if (!debouncedCrop) {
      setPreviewResults([]);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewError(null);

    previewIcon(selectedFile, debouncedCrop, debouncedPadding, debouncedIsToggle, offAdjustments, onAdjustments)
      .then((res) => {
        if (!cancelled) {
          setPreviewResults(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewResults([]);
          setPreviewError(`Preview failed: ${err}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile, debouncedCrop, debouncedPadding, debouncedIsToggle, offAdjustments, onAdjustments]);

  return { previewResults, previewError, setPreviewResults };
}
