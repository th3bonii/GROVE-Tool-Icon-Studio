pub mod image_processor;
pub mod installer;
pub mod path_detector;

use std::path::Path;

#[tauri::command]
fn detect_reaper_path() -> Result<path_detector::DetectionResult, String> {
    Ok(path_detector::detect())
}

#[tauri::command]
fn process_icon(
    input_path: String,
    output_dir: String,
    crop: Option<image_processor::CropArea>,
    state_size: Option<u32>,
) -> Result<image_processor::ProcessingOutput, String> {
    let input = Path::new(&input_path);
    let filename = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("icon");
    let output_name = format!("{}_3state.png", filename);
    let output = Path::new(&output_dir).join(output_name);
    let config = image_processor::IconConfig::default();
    let state_size = state_size.unwrap_or(30);

    image_processor::generate_three_state(
        input,
        Some(&output),
        &config,
        crop.as_ref(),
        state_size,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn preview_icon(
    input_path: String,
    crop: Option<image_processor::CropArea>,
    state_size: Option<u32>,
) -> Result<image_processor::ProcessingOutput, String> {
    let input = Path::new(&input_path);
    let config = image_processor::IconConfig::default();
    let state_size = state_size.unwrap_or(30);

    image_processor::generate_three_state(
        input,
        None,
        &config,
        crop.as_ref(),
        state_size,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn install_icon(
    source_path: String,
    reaper_resource_path: String,
    target_name: String,
) -> Result<String, String> {
    let installed = installer::install_icon(
        Path::new(&source_path),
        Path::new(&reaper_resource_path),
        &target_name,
    )?;
    Ok(installed.to_string_lossy().to_string())
}

#[tauri::command]
fn list_installed_icons(reaper_resource_path: String) -> Result<Vec<String>, String> {
    installer::list_installed_icons(Path::new(&reaper_resource_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::RgbaImage;

    /// Helper: create a small test PNG at `path` and return it.
    fn create_test_png(path: &std::path::Path) {
        let img = RgbaImage::from_pixel(64, 64, image::Rgba([100, 150, 200, 255]));
        img.save(path).expect("Failed to create test PNG");
    }

    // -----------------------------------------------------------------------
    // Task 2.1 — process_icon with crop + state_size
    // -----------------------------------------------------------------------

    #[test]
    fn process_icon_with_crop_params_uses_crop_and_size() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_crop");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let output_dir = tmp.join("out");
        std::fs::create_dir_all(&output_dir).unwrap();

        let crop = image_processor::CropArea {
            x: 0,
            y: 0,
            width: 32,
            height: 32,
        };

        // Call the IPC wrapper with crop + state_size
        let result = process_icon(
            input_path.to_string_lossy().to_string(),
            output_dir.to_string_lossy().to_string(),
            Some(crop),
            Some(38),
        )
        .expect("process_icon should succeed");

        // 3 states × 38px = 114px wide, 38px tall
        assert_eq!(result.width, 114, "Width must be state_size * 3 = 114");
        assert_eq!(result.height, 38, "Height must equal state_size = 38");
        assert!(
            result.output_path.is_some(),
            "File mode must return output_path"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn process_icon_defaults_state_size_to_30() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_default");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let output_dir = tmp.join("out");
        std::fs::create_dir_all(&output_dir).unwrap();

        // Call WITHOUT state_size — should default to 30
        let result = process_icon(
            input_path.to_string_lossy().to_string(),
            output_dir.to_string_lossy().to_string(),
            None,
            None,
        )
        .expect("process_icon should succeed");

        assert_eq!(result.width, 90, "Default state_size 30 → width 90");
        assert_eq!(result.height, 30, "Default state_size 30 → height 30");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Task 2.2 — preview_icon returns base64
    // -----------------------------------------------------------------------

    #[test]
    fn preview_icon_returns_base64_output() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_preview");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let result = preview_icon(
            input_path.to_string_lossy().to_string(),
            None,
            None,
        )
        .expect("preview_icon should succeed");

        assert!(
            result.preview_base64.is_some(),
            "Preview mode must return base64"
        );
        assert!(
            result.output_path.is_none(),
            "Preview mode must not have output_path"
        );
        assert_eq!(result.width, 90, "Default size → 3×30 = 90");
        assert_eq!(result.height, 30, "Default size → 30");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn preview_icon_with_crop_and_size_returns_correct_dims() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_preview_crop");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let crop = image_processor::CropArea {
            x: 10,
            y: 10,
            width: 20,
            height: 20,
        };

        let result = preview_icon(
            input_path.to_string_lossy().to_string(),
            Some(crop),
            Some(38),
        )
        .expect("preview_icon should succeed");

        assert!(
            result.preview_base64.is_some(),
            "Preview mode must return base64"
        );
        assert_eq!(result.width, 114, "3 × 38 = 114");
        assert_eq!(result.height, 38, "state_size = 38");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Task 2.3 — install_icon IPC wrapper
    // -----------------------------------------------------------------------

    #[test]
    fn install_icon_command_copies_file() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_install");
        std::fs::create_dir_all(&tmp).unwrap();

        let source_path = tmp.join("source.png");
        create_test_png(&source_path);

        let reaper_res = tmp.join("Data");
        std::fs::create_dir_all(&reaper_res).unwrap();

        let result = install_icon(
            source_path.to_string_lossy().to_string(),
            reaper_res.to_string_lossy().to_string(),
            "my_test_icon".to_string(),
        )
        .expect("install_icon IPC should succeed");

        let expected = reaper_res
            .join("toolbar_icons")
            .join("my_test_icon.png");
        assert!(
            expected.exists(),
            "Installed icon should exist at {:?}",
            expected
        );
        assert!(
            result.contains("my_test_icon.png"),
            "Returned path should reference the installed file"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn install_icon_command_rejects_empty_name() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_install_empty");
        std::fs::create_dir_all(&tmp).unwrap();

        let source_path = tmp.join("source.png");
        create_test_png(&source_path);

        let reaper_res = tmp.join("Data");

        let result = install_icon(
            source_path.to_string_lossy().to_string(),
            reaper_res.to_string_lossy().to_string(),
            "".to_string(),
        );

        assert!(result.is_err(), "Empty name should fail");
        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Task 2.4 — list_installed_icons IPC wrapper
    // -----------------------------------------------------------------------

    #[test]
    fn list_installed_icons_command_returns_icons() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_list");
        std::fs::create_dir_all(&tmp).unwrap();

        let source_path = tmp.join("source.png");
        create_test_png(&source_path);

        let reaper_res = tmp.join("Data");

        // Install two icons
        installer::install_icon(&source_path, &reaper_res, "alpha").unwrap();
        installer::install_icon(&source_path, &reaper_res, "beta").unwrap();

        let result = list_installed_icons(reaper_res.to_string_lossy().to_string())
            .expect("list_installed_icons should succeed");

        assert_eq!(result.len(), 2, "Should list 2 installed icons");
        assert!(result.contains(&"alpha".to_string()));
        assert!(result.contains(&"beta".to_string()));

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn list_installed_icons_command_returns_empty_for_new_dir() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_list_empty");
        std::fs::create_dir_all(&tmp).unwrap();

        let reaper_res = tmp.join("Data");

        let result = list_installed_icons(reaper_res.to_string_lossy().to_string())
            .expect("list_installed_icons should succeed");

        assert!(result.is_empty(), "New dir should have no icons");
        let _ = std::fs::remove_dir_all(&tmp);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            detect_reaper_path,
            process_icon,
            preview_icon,
            install_icon,
            list_installed_icons
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
