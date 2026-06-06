import { useState, useCallback } from 'react';
import { installIconSet, listInstalledIcons } from '../api';
import type { CropArea } from '../api';

export function useIconInstall(
  reaperPath: string | null,
  setInstalledIcons: (icons: string[]) => void,
) {
  const [installEnabled, setInstallEnabled] = useState(false);
  const [iconName, setIconName] = useState('');

  const handleInstallAction = useCallback(async (
    selectedFile: string,
    crop: CropArea,
    padding: number,
    isToggle: boolean,
    fileName: string,
  ) => {
    if (!reaperPath) return;

    try {
      await installIconSet(selectedFile, reaperPath, fileName, crop, padding, isToggle);
      const icons = await listInstalledIcons(reaperPath);
      setInstalledIcons(icons);
    } catch (err) {
      throw err;
    }
  }, [reaperPath, setInstalledIcons]);

  const handleAutoInstall = useCallback(async (
    selectedFile: string,
    reaperPathVal: string,
    crop: CropArea,
    padding: number,
    isToggle: boolean,
  ) => {
    if (!installEnabled || !iconName.trim()) return;
    await installIconSet(selectedFile, reaperPathVal, iconName.trim(), crop, padding, isToggle);
    const icons = await listInstalledIcons(reaperPathVal);
    setInstalledIcons(icons);
  }, [installEnabled, iconName, setInstalledIcons]);

  return {
    installEnabled, setInstallEnabled,
    iconName, setIconName,
    handleInstallAction, handleAutoInstall,
  };
}
