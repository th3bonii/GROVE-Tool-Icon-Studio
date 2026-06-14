# GROVE Tool Icon Studio

A desktop application for generating and managing **3-state toolbar icons** for [REAPER](https://reaper.fm) digital audio workstations. Built with Tauri v2, React, and Rust.

## Features

- **Icon Processing** — Load PNG images, crop, adjust padding, and generate REAPER-compatible toolbar icons at 3 scales (100%, 150%, 200%)
- **Toggle Mode** — Generate ON/OFF state variants with independent HSB color adjustments
- **Batch Processing** — Process multiple icons at once with shared settings
- **HSB Color Adjustment** — Fine-tune hue, saturation, and brightness for each icon state independently
- **Live Preview** — See all 3 scales and states before installing, in both states and strips view
- **REAPER Integration** — Install icons directly into REAPER's toolbar_icons directory structure
- **Icon Management** — Browse, preview, export, and delete installed icons from the interface
- **Automatic REAPER Detection** — Detects your REAPER resource directory automatically across platforms

## Installation

### Pre-built binaries

Download the latest release for your platform from the [Releases page](https://github.com/th3bonii/GROVE-Tool-Icon-Studio/releases).

| Platform | Format |
|----------|--------|
| Linux | `.deb` / `.AppImage` |
| macOS | `.dmg` |
| Windows | `.msi` / `.exe` |

### Build from source

See [DEPLOYMENT.md](DEPLOYMENT.md) for build prerequisites and instructions for each platform.

## Usage

1. **Select your REAPER path** — The app auto-detects your REAPER resource directory, or you can set it manually
2. **Choose a source image** — Load any PNG image (recommended size: 24–80px for toolbar icons)
3. **Crop and adjust** — Crop the icon area, set padding, enable toggle mode if needed
4. **Adjust colors** (optional) — Fine-tune HSB values for OFF and ON states
5. **Preview** — See how the icon will look across all scales and states
6. **Install** — Name your icon and install it directly into REAPER's toolbar
7. **Use in REAPER** — Open REAPER's toolbar editor and your icons are ready to use

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Run tests
npm run test          # TypeScript tests
cargo test --lib      # Rust tests (from src-tauri/)

# Build for production
npm run tauri build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6 |
| Backend | Rust, Tauri v2 |
| IPC | `@tauri-apps/api` (invoke-based commands) |
| Testing | Vitest + @testing-library/react (TS), cargo test (Rust) |
| Image Processing | `image` crate (PNG, resize, composite) |

## License

MIT
