import { useState, useCallback, useRef, useEffect } from 'react';
import { previewIcon, installIconSet } from '../api';
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
  const filesRef = useRef(files);

  // Sync ref with latest files value on every render
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

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
    reaperPath?: string | null,
  ) => {
    setIsProcessing(true);
    const currentFiles = filesRef.current;
    const total = currentFiles.length;
    let done = 0;

    for (let i = 0; i < currentFiles.length; i++) {
      const file = currentFiles[i];
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

        // Install directly to REAPER toolbar_icons (same as single-file processing)
        if (reaperPath) {
          await installIconSet(
            file.path,
            reaperPath,
            file.name,
            crop ?? undefined,
            padding,
            isToggle,
            offAdjustments,
            onAdjustments,
          );
        }

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
  }, []);

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
