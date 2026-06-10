# batch-processing Specification

## Purpose

Enable processing multiple source images with shared settings (crop, padding, toggle, HSB) in a single batch workflow with per-file progress and status tracking.

## Requirements

### Requirement: Batch Mode Toggle

The UI MUST provide a toggle to switch between single-file and batch modes. The mode MUST affect file selection behavior but MUST NOT reset existing crop/padding/toggle/HSB settings.

#### Scenario: Toggle enables multi-select

- GIVEN batch mode is disabled
- WHEN the user toggles batch mode on
- THEN the file selector MUST allow multiple files on next open

### Requirement: File List with Status

When batch mode is active, selected files MUST display in a list with columns: filename, status (pending/processing/done/error), and file size. Status MUST update in real-time during processing.

#### Scenario: File list updates per file

- GIVEN 2 files are selected in batch mode
- WHEN processing starts
- THEN list shows both files as "pending"
- AND as each file processes, its status transitions to "processing" then "done"

### Requirement: Process All with Shared Settings

The "Process All" button MUST iterate through selected files sequentially, applying the same crop/padding/toggle/HSB settings to each. Each file MUST be auto-named by its stem. A progress indicator MUST show current position (e.g., "3 of 5").

#### Scenario: Sequential batch processing

- GIVEN 3 files are selected with shared settings
- WHEN Process All is clicked
- THEN files process one at a time in order
- AND each output uses the source file's stem as its name
- AND progress shows "1 of 3" → "2 of 3" → "3 of 3"

#### Scenario: One file fails, others complete

- GIVEN 3 files where the second file is invalid
- WHEN Process All finishes
- THEN files 1 and 3 show status "done"
- AND file 2 shows status "error"
- AND the error message is displayed per-file

### Requirement: Install All

When batch processing completes, the "Install All" button MUST install all successfully processed icons with their auto-names. Installation MUST use sequential calls to the existing install_icon_set command.

#### Scenario: Install all successful files

- GIVEN 3 files processed, 2 succeeded and 1 failed
- WHEN Install All is clicked
- THEN both successful files MUST be installed to REAPER
- AND the failed file MUST be skipped with a note
