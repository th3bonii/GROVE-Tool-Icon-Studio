import { invoke } from '@tauri-apps/api/core';

/**
 * Result from the REAPER path detection engine.
 */
export interface DetectionResult {
  path: string | null;
  method: 'Native' | 'Wine' | 'Proton' | 'Manual';
}

/**
 * Result from the icon processing pipeline.
 */
export interface ProcessingResult {
  width: number;
  height: number;
  output_path: string;
}

/**
 * Detect the REAPER resource directory automatically.
 * Falls back to `Manual` method if no installation is found.
 */
export async function detectReaperPath(): Promise<DetectionResult> {
  return await invoke<DetectionResult>('detect_reaper_path');
}

/**
 * Process a single icon into the 3-state REAPER toolbar format.
 *
 * @param inputPath  Absolute path to the source PNG image.
 * @param outputDir  Absolute path to the directory where the output should be saved.
 * @returns Info about the generated output file.
 */
export async function processIcon(
  inputPath: string,
  outputDir: string,
): Promise<ProcessingResult> {
  return await invoke<ProcessingResult>('process_icon', {
    inputPath,
    outputDir,
  });
}
