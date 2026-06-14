# Delta for icon-manager

## ADDED Requirements

### Requirement: List Installed Icons (Async)

The system MUST provide an async `list_installed_icons(reaper_resource_path)` IPC command that scans `Data/toolbar_icons/` for PNG files and returns their filenames as `Vec<String>`. MUST NOT block the main thread — file I/O MUST run on a background thread via `spawn_blocking`.

#### Scenario: Returns installed icon list within 1 second

- GIVEN `Data/toolbar_icons/` contains 5 PNG files
- WHEN `list_installed_icons` is called
- THEN the command MUST return a list of 5 icon names (stem, no extension) in under 1 second

#### Scenario: Returns empty list for empty directory

- GIVEN `Data/toolbar_icons/` contains no PNG files
- WHEN `list_installed_icons` is called
- THEN the command MUST return an empty Vec

### Requirement: Get Icon Thumbnails (Async with Result)

The system MUST provide an async `get_icon_thumbnails(reaper_resource_path, icon_names)` IPC command. MUST read each requested PNG from `Data/toolbar_icons/` and return `Result<HashMap<String, String>, String>` mapping icon names to base64 data URIs. MUST NOT block the main thread. MUST NOT panic on I/O errors — MUST return an error Result instead.

#### Scenario: Returns thumbnails for all requested icons

- GIVEN 3 icons exist in `Data/toolbar_icons/` as valid PNGs
- WHEN `get_icon_thumbnails` is called with those 3 names
- THEN the command MUST return `Ok` with 3 HashMap entries, each a valid base64 data URI

#### Scenario: Missing file returns error Result (no panic)

- GIVEN 1 of 3 requested icons does not exist on disk
- WHEN `get_icon_thumbnails` is called
- THEN the command MUST NOT panic
- AND MUST return `Err` with a descriptive error string
- AND MUST NOT crash the Tauri process

### Requirement: Frontend Thumbnail Error Resilience

The frontend `getIconThumbnails` wrapper MUST use `safeInvoke` with a Zod `z.record(z.string(), z.string())` schema. The thumbnail `useEffect` in `InstallSection.tsx` MUST handle promise rejections via `.catch()` or try/catch.

#### Scenario: Backend error does not cause unhandled rejection

- GIVEN the backend `get_icon_thumbnails` returns an error
- WHEN the thumbnail effect fires
- THEN the promise rejection MUST be caught
- AND the UI MUST NOT display an unhandled rejection error

#### Scenario: Zod schema rejects malformed response

- GIVEN the backend returns a response that does not match `Record<string, string>`
- WHEN the `safeInvoke` Zod schema validates the response
- THEN the call MUST reject with a schema validation error
- AND the error MUST be caught by the effect's error handler

## MODIFIED Requirements

(None — `list_installed_icons` and `get_icon_thumbnails` are additions to the spec, not modifications of existing requirements.)

## REMOVED Requirements

(None.)
