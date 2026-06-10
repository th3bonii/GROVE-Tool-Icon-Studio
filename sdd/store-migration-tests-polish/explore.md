## Exploration: Store Migration, Unit Tests, Supersampling & Icon Path Issues

### Area 1: Migrate to tauri-plugin-store

#### Current State

The app persists state via `useLocalStorage<T>(key, defaultValue)` in `src/hooks/useLocalStorage.ts` (35 lines). It's a synchronous React hook that reads from `localStorage` on mount (via lazy `useState` initializer) and writes on every `setValue` call. Has a `PERSISTENCE_VERSION` field (currently `1`) and schema version checking. Used in 6 consumer sites:

| Consumer | Key(s) | Type |
|----------|--------|------|
| `App.tsx` | `grove-padding` | `number` |
| `App.tsx` | `grove-isToggle` | `boolean` |
| `App.tsx` | `grove-viewMode` | `'states' \| 'strips'` |
| `useReaperPath.ts` | `grove-reaperPath` | `string \| null` |
| `useHsbAdjustments.ts` | `grove-offAdjustments`, `grove-onAdjustments` | `[HsbAdjustment; 3]` |
| `useIconInstall.ts` | `grove-installEnabled`, `grove-iconName` | `boolean`, `string` |

The Tauri v2 backend already has `tauri-plugin-dialog = "2.0.0"` registered, plus `tauri = { version = "2.0.0", features = ["protocol-asset"] }`. The `Cargo.toml` has no `tauri-plugin-store`.

#### Tauri Plugin Store API

`@tauri-apps/plugin-store` (v2) provides:
- `Store.load()` / `Store.save()` — async, file-based JSON on disk
- `store.get(key)` / `store.set(key, value)` — async KV operations
- Lazy autosave by default (write on drop) or explicit `save()`
- Default store file at `${app_data_dir}/plugins/store/BinaryFile`
- Requires: Rust plugin registration + npm package + capability permission

#### Key Findings

1. **Two migration approaches identified**:
   - **A. Replace `useLocalStorage` entirely**: New async hook `useTauriStore<T>`. Requires changing ALL 6 consumer sites from sync to async. Breaks the current lazy `useState` initializer pattern — can't await in `useState(() => ...)`.
   - **B. Create `useTauriStore` alongside `useLocalStorage`**: Keep existing hook, add alternative for consumers that need Tauri store. Minimal change per consumer, but two storage backends to maintain.

2. **Async incompatibility**: `useState` with lazy initializer (`() => value`) is synchronous. Tauri store is async (`await store.get(key)`). You'd need `useEffect` + loading state, or a custom pattern where the store is read before the component mounts. This adds complexity.

3. **Required changes**:
   - Rust: `cargo add tauri-plugin-store` + register in `lib.rs`:
     ```rust
     .plugin(tauri_plugin_store::Builder::default().build())
     ```
   - JS: `npm install @tauri-apps/plugin-store`
   - Capabilities: Add `"store:default"` to `src-tauri/capabilities/default.json`
   - For each consumer: change hook import and usage pattern
   - Existing tests mock `@tauri-apps/api/core` invoke — they'd need to also mock `@tauri-apps/plugin-store`

4. **Effort estimate**: Medium (Rust changes ~5 lines, JS ~50 lines new hook, 6 consumer sites to update, tests to adapt)

5. **Dependencies**: None with other areas.

6. **Recommendation**: **Don't do this now** unless there's a proven issue with localStorage being cleared in Tauri's webview. The synchronous localStorage model works fine for ~1KB of settings data. The async store adds significant complexity to the hook pattern for marginal benefit. If we do it, use **Approach B** (new hook alongside existing, not replacement).

---

### Area 2: Add JS Unit Tests for useLocalStorage

#### Current State

**IMPORTANT FINDING: The frontend ALREADY HAS a test runner.** This contradicts the SDD config which says "No JS/TS test runner installed."

- `vitest` v4.1.8 is installed as a devDependency
- `@testing-library/react` v16.3.2 and `@testing-library/jest-dom` v6.9.1 are installed
- `jsdom` v29.1.1 is the test environment
- Scripts: `"test": "vitest run"` and `"test:watch": "vitest"`
- Config in `vite.config.ts`: `test: { globals: true, environment: "jsdom", setupFiles: "./src/test-setup.ts" }`
- Test setup: `import '@testing-library/jest-dom'`
- **Existing tests**: 8 test files across `src/__tests__/` and `src/hooks/__tests__/`
- Patterns used: `renderHook`, `act`, `vi.fn()`, `vi.mock()`, `vi.useFakeTimers()`
- **No `useLocalStorage.test.ts` exists**

#### Key Findings

1. **`useLocalStorage` interface**:
   ```typescript
   function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void]
   ```
   - Lazy `useState` initializer reads from `localStorage.getItem(key)`
   - If no item: returns `defaultValue`
   - If `_version` mismatch: returns `defaultValue`
   - `setValue` writes `JSON.stringify(nextValue)` to `localStorage.setItem(key, ...)`
   - All localStorage access wrapped in try/catch (private browsing, quota)
   - `setValue` supports functional updater pattern `(prev: T) => T`

2. **Test scenarios needed**:
   - Initializes with default when no item in localStorage
   - Reads existing item from localStorage on mount
   - `setValue` writes to localStorage
   - `setValue` supports functional updater
   - Schema version mismatch returns default
   - Invalid JSON in localStorage returns default
   - Multiple hooks with different keys don't interfere
   - Functional updater receives previous state correctly
   - Silent failure when localStorage throws (quota, private browsing)

3. **localStorage mock approach**: JSDOM provides `localStorage` natively. Tests can:
   - `beforeEach`: `localStorage.clear()`, `vi.clearAllMocks()`
   - Use `renderHook(() => useLocalStorage(...), ...)` and `act(...)`
   - Assert on returned values AND on `localStorage.getItem`/`setItem` calls
   - Mock `Storage.prototype.getItem` or `Storage.prototype.setItem` to throw for error testing

4. **Effort estimate**: Small (~60 lines of tests, reuse existing patterns from `useDebounce.test.tsx`)

5. **Dependencies**: None.

---

### Area 3: Supersampling for Corner Anti-Aliasing

#### Current State

`apply_rounded_rect_mask` in `src-tauri/src/image_processor.rs` (lines 637–688):
- Applies anti-aliased rounded corners to each state in the strip
- Uses Euclidean distance from arc center at `(r, r)` with a 1px transition band
- Corner radius formula (line 194, 451): `((s * 0.15) + 0.5).floor().max(2.0)`
  - This is the **UPDATED** formula (round-half-up via `+0.5` + floor, not plain `round()`)
  - 30px: 4.5+0.5=5.0 → floor=5 → radius=5
  - 45px: 6.75+0.5=7.25 → floor=7 → radius=7
  - 60px: 9.0+0.5=9.5 → floor=9 → radius=9

The `StatePreview.tsx` preview component uses `MAX_STATE_DISPLAY = 150` and `getDisplayScale()` capped at 3×. CSS has NO overflow guards (no `overflow-x: auto` or `overflow: hidden`).

The earlier exploration already found and fixed some issues:
- The dead code branch `dx <= 0 || dy <= 0` check is no longer in the code (not found in the current version)
- The rounding formula was updated from ties-to-even `round()` to `+0.5.floor()` (round-half-up)

#### Key Findings

1. **Supersampling approach**: Render the corner mask at 2× resolution, then downscale via Lanczos3. This means:
   - Create an image buffer at 2× the target state size
   - Apply the corner mask with 2× radius
   - Downscale to target size (Lanczos3 gives good AA)
   - This provides smoother alpha transitions at the cost of 4× pixels to process

2. **Implementation location**: The mask is applied in `process_variant_to_bytes()` (line 452) AFTER HSB adjustments and assembly. Supersampling would need to:
   - Before the mask step: upscale the assembled strip to 2×
   - Apply mask at 2× radius
   - Downscale back to target size
   - This adds ~30 lines of code

3. **Performance impact**: For a single state at 30px: 30×30 = 900px at 1×, 1800px at 2× → minimal. For the full strip at 60px toggle: 360×60 = 21,600px at 1×, 86,400px at 2× → still negligible for a one-shot generation. The heavy work (HSB pixel loops, resize) already runs at 1×.

4. **Existing test**: `corner_radius_30px_uses_round_half_up` (line 2153) tests the current formula by checking alpha at pixel (1,1). Would need updating if supersampling changes output pixels.

5. **Alternative simpler fix**: The previous exploration's recommendation of using `ceil()` or `+0.5.floor()` is ALREADY implemented. Visible artifacts are now likely due to the fundamental limitation of 1px AA band at small scales, not the formula.

6. **Effort estimate**: Medium (Rust code, ~30-50 lines new function + test updates)

7. **Dependencies**: None.

---

### Area 4: Icon Path Issue — Root Cause Analysis

#### Current State

**File hierarchy** (all use correct `Data/toolbar_icons` prefix):
- `REAPER_SCALE_DIRS` constant (image_processor.rs:12): `["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"]`
- `install_icon()` writes to `{resource_path}/Data/toolbar_icons/{name}.png`
- `install_icon_set()` / `install_icon_set_raw()` write to `{resource_path}/{REAPER_SCALE_DIRS[i]}/{name}.png`
- `list_installed_icons()` scans `all_scale_dirs()` which includes both `Data/` and legacy `toolbar_icons/` prefixes
- `get_icon_strip()` checks `Data/toolbar_icons` first, falls back to `toolbar_icons`
- `delete_icon()` deletes from all scale dirs (both `Data/` and legacy)

**Path detection** (`path_detector.rs`):
- On WSL: `PathBuf::from("/mnt/c/Users/{user}/AppData/Roaming/REAPER")`
- Returns a `DetectionResult { path: Option<PathBuf>, method }`
- Falls back to `Manual` if nothing found

**Frontend display** (App.tsx:368-371):
```
Data/toolbar_icons/   (30px)
Data/toolbar_icons/150/  (45px)
Data/toolbar_icons/200/  (60px)
```

The frontend display matches what the backend writes. The directory structure is correct.

#### Root Cause Analysis

**Most likely cause: WSL auto-detection fails, user selects wrong manual path.**

The auto-detection checks `/proc/version` for "Microsoft" or "WSL" markers. If the WSL kernel reports differently, or the Windows username doesn't match the WSL username, detection returns `Manual`. The user then manually selects a path.

If the user selects a path like `/mnt/c/Users/ogzuz/AppData/Roaming/REAPER/Data` (selecting the `Data` subdirectory within REAPER's resource dir), the app would write to:
- `{selected_path}/Data/toolbar_icons/` → `/mnt/c/Users/ogzuz/AppData/Roaming/REAPER/Data/Data/toolbar_icons/`

This is WRONG — it doubles the `Data` segment. REAPER would not find icons there.

**Second possible cause: WSL username mismatch.**

The auto-detection uses `dirs::home_dir()` to get the WSL home, then extracts the filename as the username (line 116-117 of path_detector.rs):
```rust
let home = dirs::home_dir()?;
let user = home.file_name()?.to_str()?;
let wsl_candidate = PathBuf::from(format!(
    "/mnt/c/Users/{}/AppData/Roaming/REAPER", user
));
```

If the WSL username doesn't match the Windows username (common with some WSL setups), this produces the wrong path. The fallback scan of all `/mnt/c/Users/` directories should catch this, but if there are multiple users it might pick the wrong one.

**Third possible cause: Double-encoding on save.**

The `setSavedManualPath` in `useReaperPath.ts` saves the user's selected directory to localStorage key `grove-reaperPath`. On next launch (line 13-15):
```typescript
if (savedManualPath) {
    setReaperPath({ path: savedManualPath, method: 'Manual' });
}
```

This correctly restores the path. But if the user originally selected a wrong path, it will be wrong on every subsequent launch.

**Root cause verdict**: The most probable root cause is a **path mismatch between what the user expects and what the backend writes** — specifically:
1. The WSL detection might not work (username mismatch), reverting to Manual
2. The user selects a directory that includes `Data/` as part of the path
3. The backend adds another `Data/`, creating a double-`Data` path
4. Icons go to the wrong place

Or alternatively: the WSL detection DOES work, but the user is looking in the wrong place — looking directly in `toolbar_icons/` instead of `Data/toolbar_icons/`.

#### Verification Steps Needed

1. Add debug logging to `install_icon_set` to print the actual write paths
2. Check the detection result: does `detectReaperPath()` return a path or is it Manual?
3. Check the REAPER resource directory: does it contain `Data/toolbar_icons/` or just `toolbar_icons/`?
4. Verify the actual filesystem: `ls -la /mnt/c/Users/ogzuz/AppData/Roaming/REAPER/Data/toolbar_icons/`

#### Current Mitigations

The code already has:
- Legacy backward compat (scans both `Data/` and non-`Data/` paths)
- Deduplication in `all_scale_dirs()`
- Base64 decode → temp → atomic rename pattern to avoid partial writes

#### Effort for Fix

- **Add debug logging**: Small (add `println!` or `log` to installer functions)
- **Add "Data" directory detection**: Small (check both with and without Data prefix, prefer existing)
- **Better error messages in UI**: Small (surface actual write path to user)
- **The fix is likely a 1-line check or a log statement**

---

### Summary of Findings

| Area | Effort | Has Tests? | Blocking? | Priority |
|------|--------|-----------|-----------|----------|
| 1. tauri-plugin-store | Medium | No (needs new) | No (localStorage works) | Low — don't start |
| 2. useLocalStorage tests | Small | N/A (new tests) | No | Medium — easy win |
| 3. Supersampling | Medium | Yes (existing, needs update) | No | Low — nice to have |
| 4. Icon path bug | Small-Medium | Yes (existing) | **Yes — users can't find icons** | **High** |

### Dependencies Between Tasks

- Area 1 and Area 2 are **independent**
- Area 3 and Area 4 are **independent**
- Area 1 (store migration) would INVALIDATE Area 2 tests if done after (the tests would need rewriting for async API)
- **Recommended order**: Area 4 (path debug) → Area 2 (tests) → Area 3 (supersampling) → Area 1 (store migration, if at all)

### Risks

| Risk | Area | Impact | Mitigation |
|------|------|--------|------------|
| Supersampling changes pixel outputs — existing golden tests fail | 3 | Medium | Update test assertions after visual verification |
| Store migration makes all consumers async — cascading changes | 1 | High | Don't do this unless localStorage is proven unreliable |
| WSL detection won't work in CI | 4 | Low | Tests use temp dirs, not real WSL paths |
| Schema versioning in useLocalStorage needs migration in tests | 2 | Low | Test with version=1, can add migration tests later |

### Ready for Proposal

**Yes** — but with a clear ordering recommendation. Area 2 (tests) and Area 4 (path debug) should be the focus. Area 3 (supersampling) is optional polish. Area 1 (store migration) should be deferred unless there's evidence of localStorage data loss.
