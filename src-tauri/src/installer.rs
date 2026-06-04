use std::path::{Path, PathBuf};

/// Install an icon file into REAPER's toolbar_icons directory.
///
/// Copies `source_path` to `{reaper_resource_path}/toolbar_icons/{target_name}.png`,
/// creating the directory if it does not exist.
pub fn install_icon(
    source_path: &Path,
    reaper_resource_path: &Path,
    target_name: &str,
) -> Result<PathBuf, String> {
    if target_name.is_empty() {
        return Err("Target name must not be empty".to_string());
    }

    if !source_path.exists() {
        return Err(format!(
            "Source file does not exist: {}",
            source_path.display()
        ));
    }

    let target_dir = reaper_resource_path.join("toolbar_icons");
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create toolbar_icons directory: {}", e))?;

    let target_path = target_dir.join(format!("{}.png", target_name));

    std::fs::copy(source_path, &target_path)
        .map_err(|e| format!("Failed to copy icon file: {}", e))?;

    Ok(target_path)
}

/// List installed icon filenames (without extension) from REAPER's toolbar_icons directory.
///
/// Returns filenames sorted alphabetically, with the `.png` extension stripped.
pub fn list_installed_icons(
    reaper_resource_path: &Path,
) -> Result<Vec<String>, String> {
    let toolbar_dir = reaper_resource_path.join("toolbar_icons");

    if !toolbar_dir.exists() {
        return Ok(Vec::new());
    }

    let mut icons: Vec<String> = Vec::new();
    let entries = std::fs::read_dir(&toolbar_dir)
        .map_err(|e| format!("Failed to read toolbar_icons directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("png") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                icons.push(stem.to_string());
            }
        }
    }

    icons.sort();
    Ok(icons)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn create_temp_dir(name: &str) -> (std::path::PathBuf, std::path::PathBuf) {
        let tmp = std::env::temp_dir().join(name);
        std::fs::create_dir_all(&tmp).unwrap();
        let source = tmp.join("source.png");
        // Create a minimal 1x1 red PNG
        use image::{Rgba, RgbaImage};
        let img = RgbaImage::from_pixel(1, 1, Rgba([255, 0, 0, 255]));
        img.save(&source).unwrap();
        (tmp, source)
    }

    #[test]
    fn install_icon_creates_toolbar_icons_directory() {
        let (tmp_dir, source) = create_temp_dir("test_install_dir");
        let toolbar = tmp_dir.join("toolbar_icons");

        // toolbar_icons does NOT exist yet
        assert!(!toolbar.join("Data/toolbar_icons").exists());

        let reaper_res = tmp_dir.join("Data");
        let result = install_icon(&source, &reaper_res, "myicon");
        assert!(result.is_ok(), "install_icon should succeed");

        let expected = reaper_res.join("toolbar_icons").join("myicon.png");
        assert!(expected.exists(), "Icon file should exist at {:?}", expected);
        assert_eq!(result.unwrap(), expected, "Returned path should match");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn install_icon_copies_file_content_correctly() {
        let (tmp_dir, source) = create_temp_dir("test_install_content");
        let reaper_res = tmp_dir.join("Data");

        let result = install_icon(&source, &reaper_res, "testicon");
        assert!(result.is_ok());

        let installed = result.unwrap();
        assert!(installed.exists());

        // Verify content is the same
        let source_bytes = std::fs::read(&source).unwrap();
        let installed_bytes = std::fs::read(&installed).unwrap();
        assert_eq!(source_bytes, installed_bytes, "File content must match");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn install_icon_rejects_empty_name() {
        let (tmp_dir, source) = create_temp_dir("test_install_empty_name");
        let reaper_res = tmp_dir.join("Data");

        let result = install_icon(&source, &reaper_res, "");
        assert!(result.is_err(), "Empty target name should fail");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn install_icon_rejects_nonexistent_source() {
        let tmp = std::env::temp_dir().join("test_install_missing_source");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.join("Data");
        let missing_source = tmp.join("does_not_exist.png");

        let result = install_icon(&missing_source, &reaper_res, "icon");
        assert!(result.is_err(), "Missing source file should fail");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn list_installed_icons_returns_empty_for_new_directory() {
        let tmp = std::env::temp_dir().join("test_list_empty");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.join("Data");

        let result = list_installed_icons(&reaper_res);
        assert!(result.is_ok(), "list_installed_icons should succeed");
        let icons = result.unwrap();
        assert!(icons.is_empty(), "New directory should have no icons");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn list_installed_icons_returns_installed_icons_sorted() {
        let (tmp_dir, source) = create_temp_dir("test_list_populated");
        let reaper_res = tmp_dir.join("Data");

        // Install a couple of icons
        install_icon(&source, &reaper_res, "beta").unwrap();
        install_icon(&source, &reaper_res, "alpha").unwrap();
        install_icon(&source, &reaper_res, "gamma").unwrap();

        let result = list_installed_icons(&reaper_res);
        assert!(result.is_ok());
        let icons = result.unwrap();

        assert_eq!(icons.len(), 3, "Should find 3 icons");
        assert_eq!(icons[0], "alpha", "Should be sorted first");
        assert_eq!(icons[1], "beta", "Should be sorted second");
        assert_eq!(icons[2], "gamma", "Should be sorted third");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn list_installed_icons_filters_non_png_files() {
        let (tmp_dir, _source) = create_temp_dir("test_list_filter");
        let reaper_res = tmp_dir.join("Data");
        let toolbar = reaper_res.join("toolbar_icons");
        std::fs::create_dir_all(&toolbar).unwrap();

        // Create mixed files
        std::fs::write(toolbar.join("icon.png"), "fake_png").unwrap();
        std::fs::write(toolbar.join("notes.txt"), "not an icon").unwrap();
        std::fs::write(toolbar.join("data.bin"), &[0u8; 4]).unwrap();

        let result = list_installed_icons(&reaper_res);
        assert!(result.is_ok());
        let icons = result.unwrap();

        assert_eq!(icons.len(), 1, "Only .png files should be listed");
        assert_eq!(icons[0], "icon", "Extension should be stripped");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }
}
