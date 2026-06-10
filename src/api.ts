import { z } from 'zod';
import { safeInvoke } from './validation';
import { ProcessingOutputSchema, DetectionResultSchema } from './validation';
import type { CropArea, HsbAdjustment, ProcessingOutput, DetectionResult } from './validation';

// Re-export types and errors for consumers
export type { CropArea, HsbAdjustment, ProcessingOutput, DetectionResult };
export { IPCValidationError } from './validation';

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

/// Corner radius factor for rounded-rect mask.
/// Applied as `Math.floor(scale * CORNER_RADIUS_FACTOR + 0.5)` with a minimum of 2.
/// Must match `image_processor::CORNER_RADIUS_FACTOR` in Rust.
export const CORNER_RADIUS_FACTOR = 0.15;

// Re-export the original name for backward compatibility.
// Deprecated: use ProcessingOutput instead.
/** @deprecated Use ProcessingOutput */
export type ProcessingResult = ProcessingOutput;

/**
 * Detect the REAPER resource directory automatically.
 * Falls back to `Manual` method if no installation is found.
 */
export async function detectReaperPath(): Promise<DetectionResult> {
  return safeInvoke('detect_reaper_path', {}, DetectionResultSchema);
}

/**
 * Process a single icon into multi-scale REAPER toolbar format (file mode).
 * Generates all 3 scales (100%, 150%, 200%) with optional padding and toggle.
 *
 * @param inputPath  Absolute path to the source PNG image.
 * @param outputDir  Absolute path to the directory where the output should be saved.
 * @param crop       Optional crop region to extract before processing.
 * @param padding    Optional padding inset in pixels (0–4, defaults to 4).
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
  return safeInvoke('process_icon', {
    inputPath,
    outputDir,
    crop: crop ?? null,
    padding: padding ?? null,
    isToggle: isToggle ?? null,
    offAdjustments: offAdjustments ?? null,
    onAdjustments: onAdjustments ?? null,
  }, ProcessingOutputSchema.array());
}

/**
 * Preview a single icon in multi-scale REAPER toolbar format (base64 mode).
 * Generates all 3 scales with base64-encoded preview data.
 *
 * @param inputPath  Absolute path to the source PNG image.
 * @param crop       Optional crop region to extract before processing.
 * @param padding    Optional padding inset in pixels (0–4, defaults to 4).
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
  return safeInvoke('preview_icon', {
    inputPath,
    crop: crop ?? null,
    padding: padding ?? null,
    isToggle: isToggle ?? null,
    offAdjustments: offAdjustments ?? null,
    onAdjustments: onAdjustments ?? null,
  }, ProcessingOutputSchema.array());
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
  return safeInvoke('install_icon_set', {
    inputPath,
    reaperResourcePath,
    targetName,
    crop: crop ?? null,
    padding: padding ?? null,
    isToggle: isToggle ?? null,
    offAdjustments: offAdjustments ?? null,
    onAdjustments: onAdjustments ?? null,
  }, z.string().array());
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
  return safeInvoke('install_icon', {
    sourcePath,
    reaperResourcePath,
    targetName,
  }, z.string());
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
  return safeInvoke('list_installed_icons', {
    reaperResourcePath,
  }, z.string().array());
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
  return safeInvoke('delete_icon', {
    reaperResourcePath,
    iconName,
  }, z.void());
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
  return safeInvoke('get_icon_strip', {
    reaperResourcePath,
    iconName,
  }, z.string());
}

/**
 * Write base64-encoded data to a file on disk.
 * Used for exporting icon strips to user-selected locations.
 *
 * @param path  Absolute path to the output file.
 * @param data  Base64-encoded data to write.
 */
export async function writeFile(path: string, data: string): Promise<void> {
  return safeInvoke('write_file', { path, data }, z.void());
}
