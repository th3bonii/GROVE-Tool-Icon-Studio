interface InstallPanelProps {
  reaperPath: string | null;
  onInstall: (fileName: string) => void;
  installedIcons: string[];
  disabled: boolean;
  iconName: string;
  installEnabled: boolean;
  onIconNameChange: (name: string) => void;
  onInstallEnabledChange: (enabled: boolean) => void;
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
}: InstallPanelProps) {
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

  return (
    <div className="install-panel">
      <h2>Install to REAPER</h2>

      {/* File name input */}
      <div
        className="install-field"
        style={{ marginBottom: '0.75rem' }}
      >
        <label
          htmlFor="install-filename"
          style={{
            display: 'block',
            fontSize: '0.8rem',
            marginBottom: '0.25rem',
            color: 'var(--color-text-muted, #8899aa)',
          }}
        >
          Icon file name
        </label>
        <input
          id="install-filename"
          type="text"
          placeholder="icon-name"
          value={iconName}
          onChange={(e) => onIconNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || !reaperPath}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid var(--color-border, #0f3460)',
            background: 'var(--color-surface, #16213e)',
            color: 'var(--color-text, #eee)',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Install to REAPER toggle */}
      <div
        className="install-toggle"
        style={{ marginBottom: '0.75rem' }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
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
        <div
          className="install-path"
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-muted, #8899aa)',
            marginBottom: '0.75rem',
            wordBreak: 'break-all',
          }}
        >
          Target:{' '}
          <code
            style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '0.1rem 0.3rem',
              borderRadius: '3px',
            }}
          >
            {reaperPath}/Data/toolbar_icons/
          </code>
        </div>
      ) : (
        <p
          className="install-no-path"
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-error, #ff5252)',
            marginBottom: '0.75rem',
          }}
        >
          REAPER path not detected. Install will not be available.
        </p>
      )}

      {/* Installed icons list */}
      {installedIcons.length > 0 && (
        <div
          className="install-installed"
          style={{ marginBottom: '0.75rem' }}
        >
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-muted, #8899aa)',
              marginBottom: '0.25rem',
            }}
          >
            Installed icons:
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.25rem',
            }}
          >
            {installedIcons.map((name) => (
              <span
                key={name}
                style={{
                  fontSize: '0.7rem',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '3px',
                  color: 'var(--color-text-muted, #8899aa)',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Install button */}
      <button
        className="btn--primary"
        disabled={!canInstall}
        onClick={handleInstall}
        style={{
          width: '100%',
          padding: '0.75rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          borderRadius: '8px',
          border: '1px solid var(--color-primary, #e94560)',
          background: canInstall
            ? 'var(--color-primary, #e94560)'
            : 'var(--color-surface, #16213e)',
          color: canInstall ? '#fff' : 'var(--color-text-muted, #8899aa)',
          cursor: canInstall ? 'pointer' : 'not-allowed',
          opacity: canInstall ? 1 : 0.4,
          transition: 'all 0.2s ease',
        }}
      >
        Install
      </button>
    </div>
  );
}
