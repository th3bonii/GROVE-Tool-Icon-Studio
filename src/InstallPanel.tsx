import { useState } from 'react';

interface InstallPanelProps {
  reaperPath: string | null;
  onInstall: (fileName: string) => void;
  installedIcons: string[];
  disabled: boolean;
  iconName: string;
  installEnabled: boolean;
  onIconNameChange: (name: string) => void;
  onInstallEnabledChange: (enabled: boolean) => void;
  isToggle: boolean;
  onDelete?: (iconName: string) => void;
  onExport?: (iconName: string) => void;
  onPreview?: (iconName: string) => Promise<string | null>;
  previewStrip?: string | null;
  previewIconName?: string | null;
}

const SCALE_DIRS = [
  { label: '100%', scale: 30, pathSuffix: 'Data/toolbar_icons/' },
  { label: '150%', scale: 45, pathSuffix: 'Data/toolbar_icons/150/' },
  { label: '200%', scale: 60, pathSuffix: 'Data/toolbar_icons/200/' },
] as const;

function ensureDataUri(base64: string | null): string {
  if (!base64) return '';
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

export default function InstallPanel({
  reaperPath,
  onInstall,
  installedIcons,
  disabled,
  iconName = '',
  installEnabled = false,
  onIconNameChange = () => {},
  onInstallEnabledChange = () => {},
  isToggle = false,
  onDelete,
  onExport,
  onPreview,
  previewStrip,
  previewIconName,
}: InstallPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const canInstall =
    !disabled &&
    !!reaperPath &&
    iconName.trim().length > 0 &&
    installEnabled;

  const handleInstall = () => {
    if (!canInstall) return;
    onInstall(iconName.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canInstall) {
      handleInstall();
    }
  };

  const handleDeleteClick = (name: string) => {
    setConfirmDelete(name);
  };

  const handleConfirmDelete = (name: string) => {
    if (onDelete) {
      onDelete(name);
    }
    setConfirmDelete(null);
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
  };

  const handlePreviewClick = async (name: string) => {
    if (!onPreview) return;
    setPreviewLoading(name);
    try {
      await onPreview(name);
    } finally {
      setPreviewLoading(null);
    }
  };

  const filesPerScale = isToggle ? 2 : 1;

  return (
    <div className="install-panel">
      <h2>Install to REAPER</h2>

      {/* File name input */}
      <div className="install-field">
        <label htmlFor="install-filename" className="install-field-label">
          Icon file name
        </label>
        <input
          id="install-filename"
          type="text"
          className="install-filename-input"
          placeholder="icon-name"
          value={iconName}
          onChange={(e) => onIconNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || !reaperPath}
        />
      </div>

      {/* Install to REAPER toggle */}
      <div className="install-toggle">
        <label className="install-toggle-label">
          <input
            type="checkbox"
            checked={installEnabled}
            onChange={(e) => onInstallEnabledChange(e.target.checked)}
            disabled={!reaperPath}
          />
          Install to REAPER
        </label>
      </div>

      {/* REAPER path info */}
      {reaperPath ? (
        <div className="install-scale-paths">
          <p className="install-targets-heading">
            Install Targets
          </p>
          {SCALE_DIRS.map((dir) => (
            <div
              key={dir.scale}
              className="install-scale-row"
            >
              <span className="install-scale-badge">
                {dir.label}
              </span>
              <code className="install-scale-path">
                {reaperPath}/{dir.pathSuffix}
              </code>
              <span className="install-scale-count">
                {filesPerScale} file{filesPerScale > 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="install-no-path">
          REAPER path not detected. Install will not be available.
        </p>
      )}

      {/* Installed icons list */}
      {installedIcons.length > 0 && (
        <div className="install-installed-section">
          <p className="install-installed-heading">
            Installed icons:
          </p>
          <div className="install-installed-tags">
            {installedIcons.map((name) => (
              <div key={name} className="install-installed-item">
                <span
                  className="install-installed-tag install-installed-tag--clickable"
                  onClick={() => handlePreviewClick(name)}
                  title="Preview this icon"
                >
                  {name}
                </span>
                {previewLoading === name && (
                  <span className="install-installed-loading">…</span>
                )}
                {onDelete && (
                  <>
                    {confirmDelete === name ? (
                      <span className="install-installed-confirm">
                        <button
                          className="install-installed-confirm-yes"
                          onClick={() => handleConfirmDelete(name)}
                          title="Confirm delete"
                        >
                          ✓
                        </button>
                        <button
                          className="install-installed-confirm-no"
                          onClick={handleCancelDelete}
                          title="Cancel delete"
                        >
                          ✗
                        </button>
                      </span>
                    ) : (
                      <button
                        className="install-installed-btn install-installed-btn--delete"
                        onClick={() => handleDeleteClick(name)}
                        title="Delete icon"
                      >
                        🗑
                      </button>
                    )}
                  </>
                )}
                {onExport && (
                  <button
                    className="install-installed-btn install-installed-btn--export"
                    onClick={() => onExport(name)}
                    title="Export icon"
                  >
                    📤
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview strip for selected installed icon */}
      {previewStrip && previewIconName && (
        <div className="install-preview-strip-section">
          <p className="install-preview-strip-heading">
            Preview: {previewIconName}
          </p>
          <div className="install-preview-strip-container">
            <img
              className="install-preview-strip"
              src={ensureDataUri(previewStrip)}
              alt={`${previewIconName} strip`}
            />
          </div>
        </div>
      )}

      {/* Install button */}
      <button
        className="btn--primary install-button"
        disabled={!canInstall}
        onClick={handleInstall}
      >
        Install
      </button>
    </div>
  );
}
