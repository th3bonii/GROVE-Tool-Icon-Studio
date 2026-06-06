import { useState, useCallback } from 'react';
import { processIcon } from '../api';
import type { CropArea, ProcessingOutput } from '../api';

export function useIconProcessing() {
  const [processing, setProcessing] = useState(false);
  const [processResults, setProcessResults] = useState<ProcessingOutput[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (
    selectedFile: string,
    reaperPath: string,
    crop: CropArea,
    padding: number,
    isToggle: boolean,
  ) => {
    setProcessing(true);
    setError(null);
    setProcessResults(null);

    try {
      const res = await processIcon(selectedFile, reaperPath, crop, padding, isToggle);
      setProcessResults(res);
    } catch (err) {
      setError(`Processing failed: ${err}`);
    } finally {
      setProcessing(false);
    }
  }, []);

  return { processing, processResults, error, setProcessResults, setError, handleGenerate };
}
