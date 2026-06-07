# Design: Fix Icon Path Mismatch

## Technical Approach

Four self-contained changes: (1) fix Rust backend paths from `toolbar_icons/` to `Data/toolbar_icons/` with backward compat, (2) fix corner radius rounding, (3) add CSS overflow guard, (4) add localStorage state persistence via a generic hook. Specs referenced: all 5 delta specs.

## Architecture Decisions

### Decision: REAPER_SCALE_DIRS content & join pattern

| Option | Description | Tradeoff |
|--------|-------------|----------|
| A | Change dirs to `["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"]` + simplify joins to `reaper_resource_path.join(sub_dir)` | Cleanest — eliminates hardcoded `"toolbar_icons"` from every installer function, single source of truth. All 5 consumers (install_icon_set, install_icon_set_raw, list, delete, get_strip) reference the constant. |
| B | Keep dirs as `["", "150", "200"]` but change base join to `reaper_resource_path.join("Data").join("toolbar_icons").join(sub_dir)` | Doesn't consolidate: `list_installed_icons`, `delete_icon`, `get_icon_strip` still hardcode paths. |
| C | Change path_detector to return `{reaper}/Data` | Wrong — REAPER resource root IS `{reaper}`, not `{reaper}/Data`. Would break all other REAPER subpaths. |
| D | Change dirs to `["Data", "Data/150", "Data/200"]` + change join to `reaper_resource_path.join(sub_dir).join("toolbar_icons")` | Produces `{reaper}/Data/150/toolbar_icons/` for 150% — WRONG order. |

**Choice**: Option A. `REAPER_SCALE_DIRS = &["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"]`. All installer joins become `reaper_resource_path.join(sub_dir)` — no more `"toolbar_icons"` hardcoded in 5 places. Line references: `image_processor.rs:12`, `installer.rs:110-123`, `installer.rs:192-205`, `installer.rs:51-55`, `installer.rs:265-268`, `installer.rs:306-308`.

### Decision: Backward compatibility

Scan both `Data/toolbar_icons/` (new) and `toolbar_icons/` (legacy) when listing, deleting, and reading icons. Install writes always use new path. Detection prefers `Data/toolbar_icons` when both exist.

### Decision: Corner radius formula

`((scale as f32) * 0.15 + 0.5).floor().max(2.0)` — "round half up" instead of `round()` (ties-to-even). For 30px: `(4.5+0.5)=5.0.floor()=5` (was 4). For 45px: `(6.75+0.5)=7.25.floor()=7`. For 60px: `(9.0+0.5)=9.5.floor()=9`.

### Decision: Dead code removal

The `dx <= 0.0 || dy <= 0.0 → 0.0` branch in `apply_rounded_rect_mask` (line 662) is unreachable: `dx` and `dy` are clamped via `.min(state_w - x - 0.5).max(0.0)` with pixel-center offsets, so they're always ≥ 0.0 for valid (x,y). Remove the branch entirely — hot path simplification.

### Decision: useLocalStorage hook signature

```typescript
function useLocalStorage<T>(
  key: string,           // localStorage key (e.g. "grove-icon-settings")
  defaultValue: T,       // fallback when no stored value or version mismatch
  version?: number       // schema version (default 1)
): [T, (value: T) => void]
```

Version-aware: stored value is `{ version, data: T }`. On read, if stored version !== current version, discard and return `defaultValue`. JSON parse/stringify for serialization.

### Decision: Schema shape (version 1)

```typescript
interface PersistedState {
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  padding: number;
  isToggle: boolean;
  viewMode: 'states' | 'strips';
  reaperPath: DetectionResult | null;
  iconName: string;
  installEnabled: boolean;
}
```

## Data Flow

```
App.tsx useState → useLocalStorage hook
  ↓ read on init          ↓ write on change
localStorage "grove-icon-settings/v1"
  { version: 1, data: PersistedState }
  ↓ schema version mismatch → discard → return defaults
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs:12` | Modify | `REAPER_SCALE_DIRS` → `["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"]` |
| `src-tauri/src/image_processor.rs:451` | Modify | Corner radius calc: `((s as f32)*0.15+0.5).floor().max(2.0)` |
| `src-tauri/src/image_processor.rs:662` | Modify | Remove dead `dx <= 0.0 \|\| dy <= 0.0` branch |
| `src-tauri/src/installer.rs` | Modify | All path joins use `REAPER_SCALE_DIRS` — dirs replaced with simplified join. `install_icon()` and `get_icon_strip()` join `Data/toolbar_icons/` directly. `list_installed_icons()` and `delete_icon()` iterate `REAPER_SCALE_DIRS`. |
| `src-tauri/src/installer.rs:330-841` | Modify | Tests: update expected paths to `Data/toolbar_icons/...` |
| `src-tauri/src/path_detector.rs` | Modify | Add `check_toolbar_icons()` that checks both `Data/toolbar_icons` and `toolbar_icons`, preferring the former |
| `src/InstallPanel.tsx:20-24` | Modify | `SCALE_DIRS` pathSuffix: `Data/toolbar_icons/` stays correct |
| `src/App.css` | Modify | Add `.state-preview { overflow-x: auto; }` |
| `src/hooks/useLocalStorage.ts` | Create | Generic typed hook with versioned schema |
| `src/hooks/useHsbAdjustments.ts` | Modify | Wire `useLocalStorage` for `offAdjustments`, `onAdjustments` |
| `src/App.tsx` | Modify | Wire `useLocalStorage` for `padding`, `isToggle`, `viewMode`, `iconName`, `installEnabled` + `useReaperPath` for `reaperPath` |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Corner radius calc | Assert 30→5, 45→7, 60→9, min 2.0 |
| Unit | Dead code removed | Assert no `dx <= 0.0 \|\| dy <= 0.0` in source |
| Unit | Path join | Assert `REAPER_SCALE_DIRS` join produces `{reaper}/Data/toolbar_icons/...` |
| Unit | useLocalStorage | Mock localStorage, test roundtrip + version discard |
| Integration | installer CRUD | Update existing tests: assert files land at `Data/toolbar_icons/` |
| Integration | path_detector | Test bi-directional detection (new dir, legacy dir, both) |
| E2E | Full pipeline | Generate + install → verify file at `Data/toolbar_icons/{name}.png` |

## Open Questions

- [ ] Should `install_icon` (single file variant, line 10-36) be deprecated in favor of `install_icon_set`? It still uses the old single-dir pattern. Keep for now, fix its path only.
- [ ] `get_icon_strip` only reads from 100% scale — is this intentional or should it fall back to legacy dir?
