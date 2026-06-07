# Proposal: Fix Icon Path Mismatch

## Intent

Fix a critical mismatch: frontend shows paths with `Data/` prefix, backend writes without it. REAPER can't find icons because it expects `Data/toolbar_icons/`. Also fixes corner radius rounding for 30px icons and adds state persistence.

## Scope

### In Scope
- Fix `Data/toolbar_icons` paths in `installer.rs` and `image_processor.rs` (REAPER_SCALE_DIRS)
- Bi-directional path detection (check both `Data/toolbar_icons` and `toolbar_icons`)
- Fix corner radius: 30px → radius=5 (currently 4 via `round()` ties-to-even)
- Add CSS `overflow-x: auto` to `.state-preview` containers
- Remove dead `dx <= 0.0 || dy <= 0.0` branch in `apply_rounded_rect_mask`
- Add `useLocalStorage<T>` hook for HSB, padding, toggle, path, icon name

### Out of Scope
- Tauri Store plugin migration
- Full app state persistence (crop, batch files, window size)
- Supersampling for corner anti-aliasing

## Capabilities

### New Capabilities
- `state-persistence`: Generic localStorage hook for session-to-session UI state

### Modified Capabilities
- `icon-processing-pipeline`: REAPER_SCALE_DIRS gets `Data/` prefix; corner radius changes from `round()` to `floor()`-based calc
- `visual-editor`: InstallPanel path display must match actual write paths
- `icon-manager`: All CRUD paths (`delete_icon`, `get_icon_strip`, `list_installed_icons`) need `Data/toolbar_icons/`

## Approach

**Phase 1 — Backend path fix**: Change `REAPER_SCALE_DIRS` to `["Data", "Data/150", "Data/200"]`. Adjust installer to detect both old (`toolbar_icons`) and new (`Data/toolbar_icons`) resource layouts. Update `install_icon`, `install_icon_set`, and `list_installed_icons` to use `Data/` prefix.

**Phase 2 — Corner + dead code**: Change radius calc from `.round().max(2.0)` to `((s as f32) * 0.15 + 0.5).floor().max(2.0)`. Remove `dx <= 0.0 || dy <= 0.0 → 0.0` branch.

**Phase 3 — CSS**: Add `overflow-x: auto` to `.state-preview` in `App.css`.

**Phase 4 — Persistence**: Create `src/hooks/useLocalStorage.ts` with versioned JSON schema. Persist: offAdjustments, onAdjustments, padding, isToggle, viewMode, reaperPath, iconName, installEnabled.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/src/installer.rs` | Modified | All path joins add `Data/` prefix |
| `src-tauri/src/image_processor.rs` | Modified | REAPER_SCALE_DIRS const, radius calc, dead code |
| `src/InstallPanel.tsx` | Modified | SCALE_DIRS pathSuffix constants |
| `src/App.css` | Modified | Add `overflow-x: auto` to `.state-preview` |
| `src/hooks/useLocalStorage.ts` | New | Generic persistence hook |
| `src/hooks/*.ts` | Modified | Wire persistence into existing hooks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Break existing installs at `toolbar_icons/` (no Data) | Low | Backward compat: detect both layouts |
| Tests expect old REAPER_SCALE_DIRS values | Med | Update inline test assertions |
| localStorage schema drift | Low | Version field + initial migration |

## Rollback Plan

Revert `REAPER_SCALE_DIRS` to `["", "150", "200"]` and restore installer path logic. Corner calc and dead code removal are cosmetic — no rollback needed. Revert `useLocalStorage` if persistence causes issues.

## Dependencies

None — self-contained Rust + TS changes.

## Success Criteria

- [ ] Backend writes icons to `{reaperPath}/Data/toolbar_icons/` at all 3 scales
- [ ] Frontend displays exact write paths (no misleading `Data/` prefix)
- [ ] Existing icons at `toolbar_icons/` (no Data) still listed
- [ ] Corner radius for 30px icons = 5px (verified via test)
- [ ] `.state-preview` has horizontal scroll on overflow
- [ ] HSB/padding/toggle/path/iconName survive page refresh
- [ ] `cargo test` passes with updated assertions
