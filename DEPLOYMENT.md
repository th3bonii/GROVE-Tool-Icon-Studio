# Deployment Guide — Grove Tool Icon Studio

## Build Prerequisites

### Linux (Ubuntu / Debian)

```bash
# System dependencies for Tauri v2
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev

# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### macOS

```bash
# Xcode Command Line Tools (includes most dependencies)
xcode-select --install
```

No additional system dependencies are required — Tauri uses the system WebView (WKWebView).

### Windows

- Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (included in Windows 10 1803+)
- Install [Rust for Windows](https://rustup.rs/)

---

## Development Build

```bash
# Install Node dependencies
npm ci

# Build frontend + Rust backend (development mode)
npm run tauri dev
```

## Production Build

```bash
# Install Node dependencies
npm ci

# Build Tauri bundles (creates .deb, .AppImage on Linux;
# .dmg on macOS; .msi on Windows)
npm run tauri build
```

The built artifacts are placed in:

| Platform | Bundle path |
|----------|-------------|
| Linux    | `src-tauri/target/release/bundle/deb/` (`.deb`) |
| Linux    | `src-tauri/target/release/bundle/appimage/` (`.AppImage`) |
| macOS    | `src-tauri/target/release/bundle/dmg/` (`.dmg`) |
| Windows  | `src-tauri/target/release/bundle/msi/` (`.msi`) |

### Cross-Platform Builds

The CI release workflow (`.github/workflows/release.yml`) runs `cargo tauri build` on all three platforms via a matrix strategy. Each platform builds natively — no cross-compilation is required.

---

## Release Workflow

1. **Push a version tag** to trigger the release pipeline:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

2. The `release.yml` workflow runs:
   - `cargo tauri build` on Ubuntu, macOS, and Windows
   - Uploads `.deb`, `.AppImage`, `.dmg`, and `.msi` artifacts to a GitHub Release
   - Auto-generates release notes from commits since the last tag

3. The GitHub Release is published with all platform bundles attached.

**Important**: Tags MUST match the `v*` pattern (e.g., `v1.2.3`, `v0.1.0-rc1`). Tags that do not match `v*` are ignored.

---

## Bundle Analysis

To visualize the frontend bundle composition:

```bash
npm run analyze
```

This runs `vite build` in analyze mode, generating an interactive treemap at `dist/stats.html` using `rollup-plugin-visualizer`. Use this to identify large dependencies, track code-splitting effectiveness, and monitor bundle size regressions.

React and ReactDOM are intentionally extracted into a separate `react-vendor` chunk via `manualChunks` in `vite.config.ts`, keeping the app chunk smaller and enabling better browser caching.

---

## Dependency Auditing

### Per-PR Audit

Every pull request runs `npm audit` and `cargo audit` as part of the CI pipeline (`.github/workflows/ci.yml`, `audit` job). If either tool detects a vulnerability above the `high` severity threshold, the CI check fails.

### Weekly Scheduled Audit

A separate weekly workflow (`.github/workflows/audit-weekly.yml`) runs every Monday at 06:00 UTC. This catches vulnerabilities published between PR commits.

### False Positive Management

If an advisory is a known false positive (e.g., a crate with no actual impact), add an `--ignore` flag to the audit command in the workflow file:

```yaml
- name: cargo audit
  run: |
    cargo install cargo-audit --locked
    cargo audit --ignore RUSTSEC-XXXX-XXXX
```

Document the justification in a comment above the `--ignore` flag so the decision is auditable.

---

## Error Reporting

### Rust Panics

When the Rust backend panics, the panic message and backtrace are written to:

- **Linux**: `~/.local/share/com.grove.iconstudio/error.log`
- **macOS**: `~/Library/Application Support/com.grove.iconstudio/error.log`
- **Windows**: `%APPDATA%/com.grove.iconstudio/error.log`

The log file is capped at 1 MB. Older entries are truncated when the limit is exceeded. At most 5 error entries are written per session — subsequent errors are silently dropped.

### React Render Crashes

The `ErrorBoundary` component (wrapping the entire app in `main.tsx`) catches unhandled React render errors and persists them to the same `error.log` file via Tauri IPC. This ensures frontend crashes are recorded without requiring external services.
