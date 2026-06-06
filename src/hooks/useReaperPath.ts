import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { detectReaperPath, listInstalledIcons } from '../api';
import type { DetectionResult } from '../api';

export function useReaperPath() {
  const [reaperPath, setReaperPath] = useState<DetectionResult | null>(null);
  const [installedIcons, setInstalledIcons] = useState<string[]>([]);

  // Auto-detect on mount
  useEffect(() => {
    detectReaperPath()
      .then(setReaperPath)
      .catch((err) => console.error('Path detection failed:', err));
  }, []);

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
    }
  }, []);

  return { reaperPath, setReaperPath, installedIcons, setInstalledIcons, handleSelectReaperDir };
}
