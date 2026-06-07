import { useCallback } from 'react';
import { installIconSet, listInstalledIcons, deleteIcon, getIconStrip, writeFile } from '../api';
import type { CropArea, HsbAdjustment } from '../api';
import { save } from '@tauri-apps/plugin-dialog';
import { useLocalStorage } from './useLocalStorage';

export function useIconInstall(
  reaperPath: string | null,
  setInstalledIcons: (icons: string[]) => void,
) {
  const [installEnabled, setInstallEnabled] = useLocalStorage('grove-installEnabled', false);
  const [iconName, setIconName] = useLocalStorage('grove-iconName', '');

  const handleInstallAction = useCallback(async (
    selectedFile: string,
    crop: CropArea,
    padding: number,
    isToggle: boolean,
    fileName: string,
    offAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
    onAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
  ) => {
    if (!reaperPath) return;

    try {
      await installIconSet(selectedFile, reaperPath, fileName, crop, padding, isToggle, offAdjustments, onAdjustments);
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
    offAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
    onAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
  ) => {
    if (!installEnabled || !iconName.trim()) return;
    await installIconSet(selectedFile, reaperPathVal, iconName.trim(), crop, padding, isToggle, offAdjustments, onAdjustments);
    const icons = await listInstalledIcons(reaperPathVal);
    setInstalledIcons(icons);
  }, [installEnabled, iconName, setInstalledIcons]);

  const handleDeleteIcon = useCallback(async (iconName: string) => {
    if (!reaperPath) return;
    await deleteIcon(reaperPath, iconName);
    const icons = await listInstalledIcons(reaperPath);
    setInstalledIcons(icons);
  }, [reaperPath, setInstalledIcons]);

  const handleGetStrip = useCallback(async (iconName: string): Promise<string | null> => {
    if (!reaperPath) return null;
    try {
      return await getIconStrip(reaperPath, iconName);
    } catch {
      return null;
    }
  }, [reaperPath]);

  const handleExportIcon = useCallback(async (iconName: string) => {
    if (!reaperPath) return;
    try {
      const b64 = await getIconStrip(reaperPath, iconName);
      const savePath = await save({
        defaultPath: `${iconName}.png`,
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });
      if (savePath) {
        await writeFile(savePath, b64);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [reaperPath]);

  return {
    installEnabled, setInstallEnabled,
    iconName, setIconName,
    handleInstallAction, handleAutoInstall,
    handleDeleteIcon, handleExportIcon, handleGetStrip,
  };
}
