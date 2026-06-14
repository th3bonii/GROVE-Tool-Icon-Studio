import { useState, useCallback } from 'react';

interface InstallPanelProps {
  reaperPath: string | null;
  installedIcons: string[];
  onDeleteSelected?: (names: string[]) => Promise<void>;
  onExportSelected?: (names: string[]) => Promise<void>;
  onPreview?: (iconName: string) => Promise<string | null>;
  previewStrip?: string | null;
  previewIconName?: string | null;
  thumbnails?: Record<string, string>;
}

const SCALE_DIRS = [
  { label: '100%', pathSuffix: 'Data/toolbar_icons/' },
  { label: '150%', pathSuffix: 'Data/toolbar_icons/150/' },
  { label: '200%', pathSuffix: 'Data/toolbar_icons/200/' },
] as const;

function ensureDataUri(base64: string | null): string {
  if (!base64) return '';
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

export default function InstallPanel({
  reaperPath,
  installedIcons,
  onDeleteSelected,
  onExportSelected,
  onPreview,
  previewStrip,
  previewIconName,
  thumbnails = {},
}: InstallPanelProps) {
  const [selectedIcons, setSelectedIcons] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const hasSelection = selectedIcons.size > 0;

  // ── Selection handling ──────────────────────────────────────────────────

  const toggleSelection = useCallback((name: string) => {
    setSelectedIcons((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIcons(new Set(installedIcons));
  }, [installedIcons]);

  const deselectAll = useCallback(() => {
    setSelectedIcons(new Set());
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handlePreviewClick = async (name: string) => {
    if (!onPreview) return;
    setPreviewLoading(name);
    try {
      await onPreview(name);
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleDeleteAction = useCallback(async () => {
    if (!onDeleteSelected || !hasSelection) return;
    setActionLoading(true);
    try {
      await onDeleteSelected(Array.from(selectedIcons));
      setSelectedIcons(new Set());
      setShowDeleteConfirm(false);
    } finally {
      setActionLoading(false);
    }
  }, [onDeleteSelected, selectedIcons, hasSelection]);

  const handleExportAction = useCallback(async () => {
    if (!onExportSelected || !hasSelection) return;
    setActionLoading(true);
    try {
      await onExportSelected(Array.from(selectedIcons));
    } finally {
      setActionLoading(false);
    }
  }, [onExportSelected, selectedIcons, hasSelection]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="install-panel">
      {/* REAPER path info */}
      {reaperPath ? (
        <div className="install-scale-paths">
          <p className="install-targets-heading">Install Targets</p>
          {SCALE_DIRS.map((dir) => (
            <div key={dir.label} className="install-scale-row">
              <span className="install-scale-badge">{dir.label}</span>
              <code className="install-scale-path">
                {reaperPath}/{dir.pathSuffix}
              </code>
            </div>
          ))}
        </div>
      ) : (
        <p className="install-no-path">
          REAPER path not detected.
        </p>
      )}

      {/* Installed icons list */}
      {installedIcons.length > 0 && (
        <div className="install-installed-section">
          {/* Header bar: selection controls + global actions */}
          <div className="install-installed-header">
            <span className="install-installed-heading">
              Installed icons ({installedIcons.length})
            </span>
            <div className="install-installed-header-actions">
              {hasSelection ? (
                <>
                  <a
                    href="#"
                    className="install-header-link"
                    onClick={(e) => { e.preventDefault(); deselectAll(); }}
                  >
                    Deselect all
                  </a>
                  <span className="install-header-count">
                    {selectedIcons.size} selected
                  </span>
                </>
              ) : (
                <a
                  href="#"
                  className="install-header-link"
                  onClick={(e) => { e.preventDefault(); selectAll(); }}
                >
                  Select all
                </a>
              )}

              {hasSelection && showDeleteConfirm ? (
                <span className="install-header-confirm">
                  <span className="install-header-confirm-text">
                    Delete {selectedIcons.size} icon{selectedIcons.size > 1 ? 's' : ''}?
                  </span>
                  <button
                    className="install-header-btn install-header-btn--confirm-yes"
                    onClick={handleDeleteAction}
                    disabled={actionLoading}
                  >
                    ✓ Yes
                  </button>
                  <button
                    className="install-header-btn install-header-btn--confirm-no"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={actionLoading}
                  >
                    ✗ No
                  </button>
                </span>
              ) : (
                <>
                  <button
                    className="install-header-btn install-header-btn--delete"
                    disabled={!hasSelection || actionLoading}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Selected
                  </button>
                  <button
                    className="install-header-btn install-header-btn--export"
                    disabled={!hasSelection || actionLoading}
                    onClick={handleExportAction}
                  >
                    Export Selected
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Icon grid */}
          <div className="install-installed-tags">
            {installedIcons.map((name) => {
              const isSelected = selectedIcons.has(name);
              return (
                <div
                  key={name}
                  className={
                    'install-installed-item' +
                    (isSelected ? ' install-installed-item--selected' : '')
                  }
                >
                  <label className="install-installed-checkbox-label">
                    <input
                      type="checkbox"
                      className="install-installed-checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(name)}
                    />
                  </label>
                  {thumbnails[name] ? (
                    <img
                      className="install-installed-thumb"
                      src={ensureDataUri(thumbnails[name])}
                      alt={name}
                      width={16}
                      height={16}
                    />
                  ) : (
                    <span className="install-installed-thumb install-installed-thumb--placeholder" />
                  )}
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
                </div>
              );
            })}
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
    </div>
  );
}
