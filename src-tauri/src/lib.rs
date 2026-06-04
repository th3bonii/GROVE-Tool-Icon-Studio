pub mod image_processor;
pub mod installer;
pub mod path_detector;

use std::path::Path;

#[tauri::command]
fn detect_reaper_path() -> Result<path_detector::DetectionResult, String> {
    Ok(path_detector::detect())
}

#[tauri::command]
fn process_icon(input_path: String, output_dir: String) -> Result<image_processor::ProcessingOutput, String> {
    let input = Path::new(&input_path);
    let filename = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("icon");
    let output_name = format!("{}_3state.png", filename);
    let output = Path::new(&output_dir).join(output_name);
    let config = image_processor::IconConfig::default();

    image_processor::generate_three_state(
        input,
        Some(&output),
        &config,
        None,
        30,
    )
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![detect_reaper_path, process_icon])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
