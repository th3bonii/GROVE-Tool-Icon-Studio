import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { detectReaperPath, listInstalledIcons } from '../api';
import type { DetectionResult } from '../api';
import { useLocalStorage } from './useLocalStorage';

export function useReaperPath() {
  const [reaperPath, setReaperPath] = useState<DetectionResult | null>(null);
  const [installedIcons, setInstalledIcons] = useState<string[]>([]);
  const [savedManualPath, setSavedManualPath] = useLocalStorage<string | null>('grove-reaperPath', null);

  // On mount: prefer saved manual path, fall back to auto-detection
  useEffect(() => {
    if (savedManualPath) {
      setReaperPath({ path: savedManualPath, method: 'Manual' });
    } else {
      detectReaperPath()
        .then(setReaperPath)
        .catch((err) => console.error('Path detection failed:', err));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // List installed icons when path resolves
  useEffect(() => {
    if (reaperPath?.path) {
      listInstalledIcons(reaperPath.path)
        .then(setInstalledIcons)
        .catch(() => { /* silently ignore */ });
    }
  }, [reaperPath]);

  const handleSelectReaperDir = useCallback(async () => {
    const dir = await open({ directory: true, multiple: false });
    if (dir) {
      setReaperPath({ path: dir, method: 'Manual' });
      setSavedManualPath(dir);
    }
  }, [setSavedManualPath]);

  return { reaperPath, setReaperPath, installedIcons, setInstalledIcons, handleSelectReaperDir };
}
