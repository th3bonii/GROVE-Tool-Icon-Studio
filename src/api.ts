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
 * Result from the icon processing pipeline.
 * Matches the Rust `image_processor::ProcessingOutput` struct.
 */
export interface ProcessingOutput {
  width: number;
  height: number;
  output_path: string | null;
  preview_base64: string | null;
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
 * Process a single icon into the 3-state REAPER toolbar format (file mode).
 *
 * @param inputPath  Absolute path to the source PNG image.
 * @param outputDir  Absolute path to the directory where the output should be saved.
 * @param crop       Optional crop region to extract before processing.
 * @param stateSize  Optional per-state size in px (defaults to 30).
 * @returns Info about the generated output file.
 */
export async function processIcon(
  inputPath: string,
  outputDir: string,
  crop?: CropArea,
  stateSize?: number,
): Promise<ProcessingOutput> {
  return await invoke<ProcessingOutput>('process_icon', {
    inputPath,
    outputDir,
    crop: crop ?? null,
    stateSize: stateSize ?? null,
  });
}

/**
 * Preview a single icon into the 3-state REAPER toolbar format (base64 mode).
 *
 * @param inputPath  Absolute path to the source PNG image.
 * @param crop       Optional crop region to extract before processing.
 * @param stateSize  Optional per-state size in px (defaults to 30).
 * @returns ProcessingOutput with preview_base64 set.
 */
export async function previewIcon(
  inputPath: string,
  crop?: CropArea,
  stateSize?: number,
): Promise<ProcessingOutput> {
  return await invoke<ProcessingOutput>('preview_icon', {
    inputPath,
    crop: crop ?? null,
    stateSize: stateSize ?? null,
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
 * List already-installed icon names from REAPER's toolbar_icons directory.
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
