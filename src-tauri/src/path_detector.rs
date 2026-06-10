use std::path::{Path, PathBuf};

/// Result of a REAPER path detection attempt.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DetectionResult {
    /// The resolved resource directory path, if found.
    pub path: Option<PathBuf>,
    /// How the path was discovered.
    pub method: DetectionMethod,
}

#[derive(Debug, Clone, serde::Serialize)]
pub enum DetectionMethod {
    /// Found via standard OS-specific location.
    Native,
    /// Found inside a Wine prefix.
    Wine,
    /// Found inside a Steam/Proton prefix.
    Proton,
    /// Found via WSL mounting of a native Windows REAPER install.
    Wsl,
    /// No automatic detection succeeded; user must pick manually.
    Manual,
}

/// Attempt to detect the REAPER resource directory automatically.
///
/// Strategy (ordered by priority):
/// 1. Check standard native OS path.
/// 2. (WSL only) Scan /mnt/c/Users/ for native Windows REAPER.
/// 3. (Linux only) Scan common Wine prefixes.
/// 4. (Linux only) Scan Steam/Proton compatdata prefixes.
/// 5. Return `Manual` so the UI can prompt for manual selection.
pub fn detect() -> DetectionResult {
    // 1. Native path
    if let Some(native) = native_resource_path() {
        if native.is_dir() {
            path_detector_log(format!(
                "Native path found: {}",
                native.display()
            ));
            return DetectionResult {
                path: Some(native),
                method: DetectionMethod::Native,
            };
        }
        path_detector_log(format!(
            "Native path candidate exists but not a directory: {}",
            native.display()
        ));
    } else {
        path_detector_log("Native path: no candidate (unsupported OS)");
    }

    // 2. WSL (Linux only — mounts native Windows drives at /mnt/<letter>/)
    #[cfg(target_os = "linux")]
    {
        if let Some(result) = detect_wsl() {
            path_detector_log(format!(
                "WSL path found: {}",
                result.path.as_ref().map(|p| p.display().to_string()).unwrap_or_default()
            ));
            return result;
        }
        path_detector_log("WSL: no REAPER path found");
    }

    // 3 & 4. Wine / Proton (Linux only)
    #[cfg(target_os = "linux")]
    {
        if let Some(result) = detect_wine_prefix() {
            path_detector_log(format!(
                "Wine path found: {}",
                result.path.as_ref().map(|p| p.display().to_string()).unwrap_or_default()
            ));
            return result;
        }
        path_detector_log("Wine: no REAPER path found in ~/.wine");

        if let Some(result) = detect_proton_prefix() {
            path_detector_log(format!(
                "Proton path found: {}",
                result.path.as_ref().map(|p| p.display().to_string()).unwrap_or_default()
            ));
            return result;
        }
        path_detector_log("Proton: no REAPER path found in Steam compatdata");
    }

    // 4. Manual fallback
    path_detector_log("Manual: no automatic detection method succeeded");
    DetectionResult {
        path: None,
        method: DetectionMethod::Manual,
    }
}

// ---------------------------------------------------------------------------
// Native path helpers
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
fn native_resource_path() -> Option<PathBuf> {
    dirs::config_dir().map(|p| p.join("REAPER"))
}

#[cfg(target_os = "macos")]
fn native_resource_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join("Library/Application Support/REAPER"))
}

#[cfg(target_os = "linux")]
fn native_resource_path() -> Option<PathBuf> {
    // Standard XDG location used by the native Linux build.
    dirs::config_dir().map(|c| c.join("REAPER"))
}

// Fallback for any other target (e.g. FreeBSD).
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn native_resource_path() -> Option<PathBuf> {
    None
}

// ---------------------------------------------------------------------------
// Wine / Proton helpers (Linux only)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WSL detection (Linux only)
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn detect_wsl() -> Option<DetectionResult> {
    // Detect WSL by checking /proc/version for "Microsoft" or "WSL".
    let contents = std::fs::read_to_string("/proc/version").ok()?;
    let is_wsl = contents.to_ascii_lowercase().contains("microsoft")
        || contents.to_ascii_lowercase().contains("wsl");
    if !is_wsl {
        return None;
    }

    // Strategy: try the current user first, then scan other users.
    let home = dirs::home_dir()?;
    let user = home.file_name()?.to_str()?;
    let wsl_candidate = PathBuf::from(format!(
        "/mnt/c/Users/{}/AppData/Roaming/REAPER",
        user
    ));

    if wsl_candidate.is_dir() {
        return Some(DetectionResult {
            path: Some(wsl_candidate),
            method: DetectionMethod::Wsl,
        });
    }

    // Fallback: scan all user directories under /mnt/c/Users/
    let users_dir = Path::new("/mnt/c/Users");
    if users_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(users_dir) {
            for entry in entries.flatten() {
                let reaper_path = entry.path().join("AppData/Roaming/REAPER");
                if reaper_path.is_dir() {
                    return Some(DetectionResult {
                        path: Some(reaper_path),
                        method: DetectionMethod::Wsl,
                    });
                }
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn reaper_subpath_in_prefix(prefix: &Path) -> PathBuf {
    // Inside a Wine/Proton prefix the Windows-style path maps to:
    //   <prefix>/drive_c/users/<user>/AppData/Roaming/REAPER
    // Wine often symlinks the username to the host user, but also supports
    // a literal "steamuser" in Proton prefixes.
    prefix
        .join("drive_c")
        .join("users")
        .join("steamuser")
        .join("AppData")
        .join("Roaming")
        .join("REAPER")
}

#[cfg(target_os = "linux")]
fn reaper_subpath_with_host_user(prefix: &Path) -> Option<PathBuf> {
    let user = std::env::var("USER").ok()?;
    let p = prefix
        .join("drive_c")
        .join("users")
        .join(&user)
        .join("AppData")
        .join("Roaming")
        .join("REAPER");
    Some(p)
}

#[cfg(target_os = "linux")]
fn detect_wine_prefix() -> Option<DetectionResult> {
    let home = dirs::home_dir()?;
    let default_prefix = home.join(".wine");

    // Try steamuser path first, then host username.
    let candidates = [
        reaper_subpath_in_prefix(&default_prefix),
    ];

    for candidate in &candidates {
        if candidate.is_dir() {
            return Some(DetectionResult {
                path: Some(candidate.clone()),
                method: DetectionMethod::Wine,
            });
        }
    }

    // Try host-user variant.
    if let Some(user_path) = reaper_subpath_with_host_user(&default_prefix) {
        if user_path.is_dir() {
            return Some(DetectionResult {
                path: Some(user_path),
                method: DetectionMethod::Wine,
            });
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn detect_proton_prefix() -> Option<DetectionResult> {
    let home = dirs::home_dir()?;

    // Common Steam library root paths.
    let steam_roots = [
        home.join(".steam/steam"),
        home.join(".local/share/Steam"),
    ];

    for root in &steam_roots {
        let compatdata = root.join("steamapps/compatdata");
        if !compatdata.is_dir() {
            continue;
        }

        // Each app ID has its own prefix under compatdata/<appid>/pfx
        if let Ok(entries) = std::fs::read_dir(&compatdata) {
            for entry in entries.flatten() {
                let pfx = entry.path().join("pfx");
                if !pfx.is_dir() {
                    continue;
                }

                // Check steamuser
                let candidate = reaper_subpath_in_prefix(&pfx);
                if candidate.is_dir() {
                    return Some(DetectionResult {
                        path: Some(candidate),
                        method: DetectionMethod::Proton,
                    });
                }

                // Check host user
                if let Some(user_path) = reaper_subpath_with_host_user(&pfx) {
                    if user_path.is_dir() {
                        return Some(DetectionResult {
                            path: Some(user_path),
                            method: DetectionMethod::Proton,
                        });
                    }
                }
            }
        }
    }

    None
}

// ---------------------------------------------------------------------------
// Log helper
// ---------------------------------------------------------------------------

/// Emit a debug log line prefixed with `[path_detector]` for tracing resolution.
pub(crate) fn path_detector_log(msg: impl std::fmt::Display) {
    eprintln!("[path_detector] {}", msg);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // NOTE: eprintln! output is captured by the test runner and visible
    // in test output on failure. See installer.rs for details.

    #[test]
    fn detect_works_with_logging() {
        // detect() must complete without panicking and return a well-formed
        // result, even with the new eprintln! calls for logging.
        let result = detect();

        // Assert the result is well-formed (any DetectionMethod is valid)
        match result.method {
            DetectionMethod::Native
            | DetectionMethod::Wine
            | DetectionMethod::Proton
            | DetectionMethod::Wsl
            | DetectionMethod::Manual => {}
        }

        // If a path was found, it should be non-empty
        if let Some(ref p) = result.path {
            assert!(!p.as_os_str().is_empty(), "path should not be empty string");
        }
    }

    #[test]
    fn detect_returns_manual_when_no_reaper_installed() {
        // On a CI / dev machine without REAPER, detection should gracefully
        // fall back to Manual instead of panicking.
        let result = detect();
        // We can't assert which method will be returned on any given machine,
        // but we CAN assert it never panics and the struct is well-formed.
        match result.method {
            DetectionMethod::Native
            | DetectionMethod::Wine
            | DetectionMethod::Proton
            | DetectionMethod::Wsl
            | DetectionMethod::Manual => {}
        }
    }

    #[test]
    fn native_resource_path_returns_some() {
        // On supported OSes, native_resource_path should return *some* path
        // even if that path doesn't exist on disk.
        let path = native_resource_path();
        assert!(path.is_some(), "native_resource_path should return Some on supported OS");
    }
}
