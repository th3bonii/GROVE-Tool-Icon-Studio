# icon-manager Specification

## Purpose

Backend IPC commands and frontend UI for managing installed REAPER toolbar icons: reading installed strips, deleting icons across all scales, and exporting saved strips.

## Requirements

### Requirement: Delete Icon IPC

The system MUST provide a `delete_icon(reaper_resource_path, icon_name)` IPC command that removes `icon_name.png` from all 3 scale directories (toolbar_icons/, toolbar_icons/150/, toolbar_icons/200/). MUST return `Ok(())` on success. MUST return an error if no matching files exist.

#### Scenario: Delete removes all 3 scales

- GIVEN an icon named "myicon" exists at all 3 scale directories
- WHEN `delete_icon` is called with icon_name="myicon"
- THEN all 3 files MUST be deleted
- AND the command MUST return `Ok(())`

#### Scenario: Delete returns error on missing icon

- GIVEN no files named "myicon" exist in any scale directory
- WHEN `delete_icon` is called with icon_name="myicon"
- THEN the command MUST return an error

### Requirement: Get Icon Strip IPC

The system MUST provide a `get_icon_strip(reaper_resource_path, icon_name)` IPC command that reads `toolbar_icons/{icon_name}.png` and returns its contents as a base64-encoded string.

#### Scenario: Get strip returns base64

- GIVEN strip file toolbar_icons/myicon.png exists
- WHEN `get_icon_strip` is called with icon_name="myicon"
- THEN the command MUST return the file contents as a base64 string

### Requirement: Frontend List Refresh

The installed icons list MUST refresh after every delete or install action.

#### Scenario: List updates after delete

- GIVEN the installed icons list shows 3 icons
- WHEN one icon is deleted
- THEN the list MUST show 2 icons after the refresh completes
