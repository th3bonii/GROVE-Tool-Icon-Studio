# Archive Report: fix-icon-path

**Archived**: 2026-06-07
**Mode**: hybrid
**Previous location**: `openspec/changes/fix-icon-path/`
**Archive location**: `openspec/changes/archive/2026-06-07-fix-icon-path/`

## Change Summary

Fixed critical path mismatch where frontend displayed `Data/toolbar_icons/` paths but backend wrote to `toolbar_icons/` (without `Data/`). REAPER couldn't find icons because it expects `Data/toolbar_icons/`.

## Implemented

1. **Backend path fix**: REAPER_SCALE_DIRS changed to `["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"]`. All installer functions (`install_icon`, `install_icon_set`, `install_icon_set_raw`, `list_installed_icons`, `delete_icon`, `get_icon_strip`) refactored to use shared constant.
2. **Backward compat**: `all_scale_dirs()` helper in installer.rs scans both `Data/toolbar_icons/` and legacy `toolbar_icons/` layouts.
3. **Corner radius**: Formula changed to `((s * 0.15) + 0.5).floor().max(2.0)` — eliminates ties-to-even bias.
4. **Dead code**: Removed unreachable `dx <= 0.0 || dy <= 0.0` branch.
5. **CSS overflow**: `overflow-x: auto` added to `.state-preview`.
6. **State persistence**: `useLocalStorage<T>` hook created, wired in App.tsx, useHsbAdjustments, useReaperPath, useIconInstall.

## Verification

- `cargo test`: 90 passed, 0 failed
- `npx tsc -b`: no errors
- Verdict: **PASS WITH WARNINGS** (backward compat was missing in initial verify, added post-verify)

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| icon-processing-pipeline | Updated | Added Data/toolbar_icons prefix scenario to Multi-Scale Generation; added Corner Radius Calculation requirement; added Dead Code Removal requirement |
| visual-editor | Updated | Auto-Install paths changed to Data/toolbar_icons/ prefix; added CSS Overflow Guard requirement |
| icon-manager | Updated | Delete Icon IPC and Get Icon Strip IPC paths changed from toolbar_icons/ to Data/toolbar_icons/ |
| reaper-path-detection | Unchanged | No changes needed — path detection logic unchanged |
| state-persistence | Unchanged | New domain (not in main specs) |

## Archival Contents

- proposal.md ✅
- specs/ ✅ (5 domains)
- design.md ✅
- tasks.md ✅ (14/14 tasks complete)
- verify-report.md ✅
- archive-report.md ✅

## Engram Artifact IDs

(none — persisted fresh during archive phase)

## Source of Truth Updated

- `openspec/specs/icon-processing-pipeline/spec.md`
- `openspec/specs/visual-editor/spec.md`
- `openspec/specs/icon-manager/spec.md`

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
