import { useState, useCallback } from 'react';
import { useIconInstall } from '../hooks/useIconInstall';
import InstallPanel from '../InstallPanel';
import type { CropArea, HsbAdjustment } from '../api';

interface Props {
  reaperPath: string | null;
  selectedFile: string | null;
  crop: CropArea | null;
  padding: number;
  isToggle: boolean;
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  installedIcons: string[];
  setInstalledIcons: (icons: string[]) => void;
}

export default function InstallSection({
  reaperPath,
  selectedFile,
  crop,
  padding,
  isToggle,
  offAdjustments,
  onAdjustments,
  installedIcons,
  setInstalledIcons,
}: Props) {
  const [previewStrip, setPreviewStrip] = useState<string | null>(null);
  const [previewIconName, setPreviewIconName] = useState<string | null>(null);

  const {
    installEnabled,
    setInstallEnabled,
    iconName,
    setIconName,
    handleInstallAction,
    handleDeleteIcon,
    handleExportIcon,
    handleGetStrip,
  } = useIconInstall(reaperPath, setInstalledIcons);

  const handleInstall = useCallback(
    async (fileName: string) => {
      if (!selectedFile || !reaperPath || !crop) return;
      await handleInstallAction(
        selectedFile,
        crop,
        padding,
        isToggle,
        fileName,
        offAdjustments,
        onAdjustments,
      );
    },
    [
      selectedFile,
      reaperPath,
      crop,
      padding,
      isToggle,
      offAdjustments,
      onAdjustments,
      handleInstallAction,
    ],
  );

  const handlePreview = useCallback(
    async (name: string): Promise<string | null> => {
      const b64 = await handleGetStrip(name);
      if (b64) {
        setPreviewStrip(b64);
        setPreviewIconName(name);
      }
      return b64;
    },
    [handleGetStrip],
  );

  if (!reaperPath) return null;

  return (
    <section className="section" id="install-section">
      <InstallPanel
        reaperPath={reaperPath}
        onInstall={handleInstall}
        installedIcons={installedIcons}
        disabled={!selectedFile || !crop}
        iconName={iconName}
        installEnabled={installEnabled}
        onIconNameChange={setIconName}
        onInstallEnabledChange={setInstallEnabled}
        isToggle={isToggle}
        onDelete={handleDeleteIcon}
        onExport={handleExportIcon}
        onPreview={handlePreview}
        previewStrip={previewStrip}
        previewIconName={previewIconName}
      />
    </section>
  );
}
