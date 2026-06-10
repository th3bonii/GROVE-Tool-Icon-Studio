# icon-manager Specification

## Purpose

Backend IPC commands and frontend UI for managing installed REAPER toolbar icons: reading installed strips, deleting icons across all scales, and exporting saved strips.

## Requirements

### Requirement: Delete Icon IPC

The system MUST provide a `delete_icon(reaper_resource_path, icon_name)` IPC command that removes `icon_name.png` from all 3 scale directories (Data/toolbar_icons/, Data/toolbar_icons/150/, Data/toolbar_icons/200/). MUST return `Ok(())` on success. MUST return an error if no matching files exist.
(Previously: directories were toolbar_icons/, toolbar_icons/150/, toolbar_icons/200/)

#### Scenario: Delete removes all 3 scales with Data/ prefix

- GIVEN an icon named "myicon" exists at all 3 scale directories under `Data/`
- WHEN `delete_icon` is called with icon_name="myicon"
- THEN all 3 files MUST be deleted from `Data/toolbar_icons/` and its subdirectories
- AND the command MUST return `Ok(())`

#### Scenario: Delete returns error on missing icon

- GIVEN no files named "myicon" exist in any scale directory
- WHEN `delete_icon` is called with icon_name="myicon"
- THEN the command MUST return an error

### Requirement: Get Icon Strip IPC

The system MUST provide a `get_icon_strip(reaper_resource_path, icon_name)` IPC command that reads `Data/toolbar_icons/{icon_name}.png` and returns its contents as a base64-encoded string.
(Previously: read from toolbar_icons/{icon_name}.png without Data prefix)

#### Scenario: Get strip returns base64 from Data/ path

- GIVEN strip file Data/toolbar_icons/myicon.png exists
- WHEN `get_icon_strip` is called with icon_name="myicon"
- THEN the command MUST return the file contents as a base64 string

### Requirement: Frontend List Refresh

The installed icons list MUST refresh after every delete or install action.

#### Scenario: List updates after delete

- GIVEN the installed icons list shows 3 icons
- WHEN one icon is deleted
- THEN the list MUST show 2 icons after the refresh completes
