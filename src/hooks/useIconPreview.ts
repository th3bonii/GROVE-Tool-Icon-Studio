import { useState, useEffect } from 'react';
import { previewIcon } from '../api';
import type { CropArea, ProcessingOutput } from '../api';

export function useIconPreview(
  selectedFile: string | null,
  debouncedCrop: CropArea | null,
  debouncedPadding: number,
  debouncedIsToggle: boolean,
) {
  const [previewResults, setPreviewResults] = useState<ProcessingOutput[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile || !debouncedCrop) return;

    let cancelled = false;
    setPreviewError(null);

    previewIcon(selectedFile, debouncedCrop, debouncedPadding, debouncedIsToggle)
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
  }, [selectedFile, debouncedCrop, debouncedPadding, debouncedIsToggle]);

  return { previewResults, previewError, setPreviewResults };
}
