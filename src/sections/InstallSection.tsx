import { useState, useCallback, useEffect } from 'react';
import { useIconInstall } from '../hooks/useIconInstall';
import InstallPanel from '../InstallPanel';
import { getIconThumbnails } from '../api';

interface Props {
  reaperPath: string | null;
  installedIcons: string[];
  setInstalledIcons: (icons: string[]) => void;
}

export default function InstallSection({
  reaperPath,
  installedIcons,
  setInstalledIcons,
}: Props) {
  const [previewStrip, setPreviewStrip] = useState<string | null>(null);
  const [previewIconName, setPreviewIconName] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const {
    handleDeleteIcon,
    handleExportIcon,
    handleGetStrip,
  } = useIconInstall(reaperPath, setInstalledIcons);

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

  // ── Batch actions for selection-based UI ────────────────────────────────
  const handleDeleteSelected = useCallback(async (names: string[]) => {
    for (const name of names) {
      await handleDeleteIcon(name);
    }
  }, [handleDeleteIcon]);

  const handleExportSelected = useCallback(async (names: string[]) => {
    for (const name of names) {
      await handleExportIcon(name);
    }
  }, [handleExportIcon]);

  // ── Thumbnails ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!reaperPath || installedIcons.length === 0) {
      setThumbnails({});
      return;
    }
    let cancelled = false;
    const load = async () => {
      const map = await getIconThumbnails(reaperPath, installedIcons);
      if (!cancelled) setThumbnails(map);
    };
    load().catch((err) => {
      console.error('Failed to load thumbnails:', err);
      if (!cancelled) setThumbnails({});
    });
    return () => { cancelled = true; };
  }, [installedIcons, reaperPath]);

  if (!reaperPath) return null;

  return (
    <section className="section" id="install-section">
      <InstallPanel
        reaperPath={reaperPath}
        installedIcons={installedIcons}
        onDeleteSelected={handleDeleteSelected}
        onExportSelected={handleExportSelected}
        onPreview={handlePreview}
        previewStrip={previewStrip}
        previewIconName={previewIconName}
        thumbnails={thumbnails}
      />
    </section>
  );
}
