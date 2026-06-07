import { invoke } from '@tauri-apps/api/core';

/**
 * Result from the REAPER path detection engine.
 */
export interface DetectionResult {
  path: string | null;
  method: 'Native' | 'Wine' | 'Proton' | 'Manual';
}

/**
 * Defines a rectangular region for cropping.
 * Matches the Rust `image_processor::CropArea` struct.
 */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * HSB (Hue-Saturation-Brightness) adjustment for a single icon state.
 * Matches the Rust `image_processor::HsbAdjustment` struct.
 */
export interface HsbAdjustment {
  /** Hue shift in degrees (REAPER spec locks this at 0°). */
  hue_shift: number;
  /** Additive saturation delta (percentage points, e.g. -0.20 = -20pp). */
  sat_delta: number;
  /** Additive brightness delta (percentage points, e.g. 15.0 = +15pp). */
  bri_delta: number;
}

/**
 * Configuration for multi-scale icon generation.
 * Matches the Rust `image_processor::IconConfig` struct.
 */
export interface IconConfig {
  /** Padding inset in pixels (0–4, default 2). */
  padding: number;
  /** If true, generate both OFF and ON variants. */
  is_toggle: boolean;
  /** HSB adjustments for OFF states: [Normal, Hover, Active]. */
  off_adjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  /** HSB adjustments for ON states: [Normal, Hover, Active]. */
  on_adjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
}

/**
 * Result from the icon processing pipeline.
 * Matches the Rust `image_processor::ProcessingOutput` struct.
 */
export interface ProcessingOutput {
  width: number;
  height: number;
  output_path: string | null;
  preview_base64: string | null;
  /** File suffix: "" for OFF variant, "_on" for ON variant. */
  suffix: string;
}

// Re-export the original name for backward compatibility.
// Deprecated: use ProcessingOutput instead.
/** @deprecated Use ProcessingOutput */
export type ProcessingResult = ProcessingOutput;

/**
 * Detect the REAPER resource directory automatically.
 * Falls back to `Manual` method if no installation is found.
 */
export async function detectReaperPath(): Promise<DetectionResult> {
  return await invoke<DetectionResult>('detect_reaper_path');
}

/**
 * Process a single icon into multi-scale REAPER toolbar format (file mode).
 * Generates all 3 scales (100%, 150%, 200%) with optional padding and toggle.
 *
 * @param inputPath  Absolute path to the source PNG image.
 * @param outputDir  Absolute path to the directory where the output should be saved.
 * @param crop       Optional crop region to extract before processing.
 * @param padding    Optional padding inset in pixels (0–4, defaults to 2).
 * @param isToggle   Optional toggle mode (defaults to false).
 * @returns Array of ProcessingOutput, one per scale (+ ON variant when toggle enabled).
 */
export async function processIcon(
  inputPath: string,
  outputDir: string,
  crop?: CropArea,
  padding?: number,
  isToggle?: boolean,
  offAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
  onAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
): Promise<ProcessingOutput[]> {
  return await invoke<ProcessingOutput[]>('process_icon', {
    inputPath,
    outputDir,
    crop: crop ?? null,
    padding: padding ?? null,
    isToggle: isToggle ?? null,
    offAdjustments: offAdjustments ?? null,
    onAdjustments: onAdjustments ?? null,
  });
}

/**
 * Preview a single icon in multi-scale REAPER toolbar format (base64 mode).
 * Generates all 3 scales with base64-encoded preview data.
 *
 * @param inputPath  Absolute path to the source PNG image.
 * @param crop       Optional crop region to extract before processing.
 * @param padding    Optional padding inset in pixels (0–4, defaults to 2).
 * @param isToggle   Optional toggle mode (defaults to false).
 * @returns Array of ProcessingOutput with preview_base64 set, one per scale.
 */
export async function previewIcon(
  inputPath: string,
  crop?: CropArea,
  padding?: number,
  isToggle?: boolean,
  offAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
  onAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
): Promise<ProcessingOutput[]> {
  return await invoke<ProcessingOutput[]>('preview_icon', {
    inputPath,
    crop: crop ?? null,
    padding: padding ?? null,
    isToggle: isToggle ?? null,
    offAdjustments: offAdjustments ?? null,
    onAdjustments: onAdjustments ?? null,
  });
}

/**
 * Install a generated icon into REAPER's toolbar_icons directory structure.
 * Processes the source image and writes all 3 scales (100%, 150%, 200%)
 * to the corresponding REAPER directories.
 *
 * @param inputPath          Absolute path to the source PNG image.
 * @param reaperResourcePath Absolute path to the REAPER resource directory.
 * @param targetName         Name for the installed icon (without extension).
 * @param crop               Optional crop region to extract before processing.
 * @param padding            Optional padding inset in pixels (0–4, defaults to 2).
 * @param isToggle           Optional toggle mode (defaults to false).
 * @returns Array of installed file paths.
 */
export async function installIconSet(
  inputPath: string,
  reaperResourcePath: string,
  targetName: string,
  crop?: CropArea,
  padding?: number,
  isToggle?: boolean,
  offAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
  onAdjustments?: [HsbAdjustment, HsbAdjustment, HsbAdjustment],
): Promise<string[]> {
  return await invoke<string[]>('install_icon_set', {
    inputPath,
    reaperResourcePath,
    targetName,
    crop: crop ?? null,
    padding: padding ?? null,
    isToggle: isToggle ?? null,
    offAdjustments: offAdjustments ?? null,
    onAdjustments: onAdjustments ?? null,
  });
}

/**
 * Install a generated icon into REAPER's toolbar_icons directory.
 *
 * @param sourcePath         Absolute path to the generated 3-state PNG.
 * @param reaperResourcePath Absolute path to the REAPER resource directory.
 * @param targetName         Name for the installed icon (without extension).
 * @returns The installed file path.
 */
export async function installIcon(
  sourcePath: string,
  reaperResourcePath: string,
  targetName: string,
): Promise<string> {
  return await invoke<string>('install_icon', {
    sourcePath,
    reaperResourcePath,
    targetName,
  });
}

/**
 * List already-installed icon names from REAPER's toolbar_icons directory tree.
 * Scans all 3 scale directories (toolbar_icons/, toolbar_icons/150/, toolbar_icons/200/).
 *
 * @param reaperResourcePath Absolute path to the REAPER resource directory.
 * @returns Array of installed icon names (without .png extension), sorted alphabetically.
 */
export async function listInstalledIcons(
  reaperResourcePath: string,
): Promise<string[]> {
  return await invoke<string[]>('list_installed_icons', {
    reaperResourcePath,
  });
}

/**
 * Delete an installed icon from all 3 REAPER scale directories.
 * Removes both OFF and ON variants if they exist.
 *
 * @param reaperResourcePath Absolute path to the REAPER resource directory.
 * @param iconName           Name of the icon to delete (without extension).
 */
export async function deleteIcon(
  reaperResourcePath: string,
  iconName: string,
): Promise<void> {
  return await invoke<void>('delete_icon', {
    reaperResourcePath,
    iconName,
  });
}

/**
 * Read an installed icon strip from the 100% toolbar_icons directory
 * and return its contents as a base64-encoded string.
 *
 * @param reaperResourcePath Absolute path to the REAPER resource directory.
 * @param iconName           Name of the icon to read (without extension).
 * @returns Base64-encoded PNG data.
 */
export async function getIconStrip(
  reaperResourcePath: string,
  iconName: string,
): Promise<string> {
  return await invoke<string>('get_icon_strip', {
    reaperResourcePath,
    iconName,
  });
}

/**
 * Write base64-encoded data to a file on disk.
 * Used for exporting icon strips to user-selected locations.
 *
 * @param path  Absolute path to the output file.
 * @param data  Base64-encoded data to write.
 */
export async function writeFile(path: string, data: string): Promise<void> {
  return await invoke<void>('write_file', { path, data });
}
