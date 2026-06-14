import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CropArea } from './api';
import { useReaperPath } from './hooks/useReaperPath';
import { useHsbAdjustments } from './hooks/useHsbAdjustments';
import { useLocalStorage } from './hooks/useLocalStorage';
import HeaderSection from './sections/HeaderSection';
import ReaperPathSection from './sections/ReaperPathSection';
import SourceSection from './sections/SourceSection';
import PreviewSection from './sections/PreviewSection';
import GenerateSection from './sections/GenerateSection';
import InstallSection from './sections/InstallSection';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [padding, setPadding] = useLocalStorage('grove-padding', 4);
  const [isToggle, setIsToggle] = useLocalStorage('grove-isToggle', false);
  const [viewMode, setViewMode] = useLocalStorage<'states' | 'strips'>('grove-viewMode', 'states');
  const [batchMode, setBatchMode] = useState(false);

  // Shared hooks — consumed by multiple sections
  const { offAdjustments, onAdjustments, updateOff, updateOn, resetAll } = useHsbAdjustments();
  const { reaperPath, installedIcons, setInstalledIcons, handleSelectReaperDir } = useReaperPath();

  // Single-file selector (shell-level: opens dialog, sets shell state)
  const handleSelectFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    });
    if (file) {
      setSelectedFile(file);
      setCrop(null);
      const assetUrl = convertFileSrc(file);
      setImageSrc(assetUrl);
    }
  }, []);

  // In batch mode, SourceSection handles the dialog internally and calls this for the first file
  const handleFirstBatchFile = useCallback((file: string, src: string) => {
    setSelectedFile(file);
    setCrop(null);
    setImageSrc(src);
  }, []);

  return (
    <div className="container">
      <HeaderSection />
      <ReaperPathSection
        reaperPath={reaperPath}
        onSelectReaperDir={handleSelectReaperDir}
      />
      <SourceSection
        selectedFile={selectedFile}
        imageSrc={imageSrc}
        crop={crop}
        batchMode={batchMode}
        padding={padding}
        isToggle={isToggle}
        offAdjustments={offAdjustments}
        onAdjustments={onAdjustments}
        reaperPath={reaperPath}
        onSelectFile={handleSelectFile}
        onCropChange={setCrop}
        onBatchModeChange={setBatchMode}
        onFirstBatchFile={handleFirstBatchFile}
      />
      {selectedFile && (
        <PreviewSection
          selectedFile={selectedFile}
          crop={crop}
          padding={padding}
          isToggle={isToggle}
          viewMode={viewMode}
          offAdjustments={offAdjustments}
          onAdjustments={onAdjustments}
          onPaddingChange={setPadding}
          onToggleChange={setIsToggle}
          onViewModeChange={setViewMode}
          updateOff={updateOff}
          updateOn={updateOn}
          resetAll={resetAll}
        />
      )}
      <GenerateSection
        selectedFile={selectedFile}
        reaperPath={reaperPath}
        crop={crop}
        padding={padding}
        isToggle={isToggle}
        offAdjustments={offAdjustments}
        onAdjustments={onAdjustments}
        installedIcons={installedIcons}
        setInstalledIcons={setInstalledIcons}
      />
      <InstallSection
        reaperPath={reaperPath?.path ?? null}
        installedIcons={installedIcons}
        setInstalledIcons={setInstalledIcons}
      />
    </div>
  );
}

export default App;
