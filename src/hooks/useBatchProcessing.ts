import { useState, useCallback } from 'react';
import { previewIcon } from '../api';
import type { CropArea, HsbAdjustment, ProcessingOutput } from '../api';

export interface BatchFile {
  path: string;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  results?: ProcessingOutput[];
  error?: string;
}

export function useBatchProcessing() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const addFiles = useCallback((newFiles: string[]) => {
    const entries: BatchFile[] = newFiles.map((path) => {
      const parts = path.replace(/\\/g, '/').split('/');
      const fullName = parts[parts.length - 1] || 'icon';
      const name = fullName.replace(/\.\w+$/, '') || 'icon';
      return { path, name, status: 'pending' as const };
    });
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setProgress({ done: 0, total: 0 });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const processAll = useCallback(async (
    crop: CropArea | null,
    padding: number,
    isToggle: boolean,
    offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
    onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
  ) => {
    setIsProcessing(true);
    const total = files.length;
    let done = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.status === 'done') {
        done++;
        continue;
      }

      setFiles((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'processing' };
        return next;
      });

      try {
        const results = await previewIcon(
          file.path,
          crop ?? undefined,
          padding,
          isToggle,
          offAdjustments,
          onAdjustments,
        );

        setFiles((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'done', results };
          return next;
        });
        done++;
      } catch (err) {
        setFiles((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error', error: String(err) };
          return next;
        });
      }

      setProgress({ done, total });
    }

    setIsProcessing(false);
  }, [files]);

  const resetProgress = useCallback(() => {
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        status: 'pending' as const,
        results: undefined,
        error: undefined,
      })),
    );
    setProgress({ done: 0, total: 0 });
  }, []);

  return {
    files,
    addFiles,
    clearFiles,
    removeFile,
    isProcessing,
    progress,
    processAll,
    resetProgress,
  };
}
