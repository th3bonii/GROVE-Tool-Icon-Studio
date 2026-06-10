# Design: App.tsx Decomposition

## Technical Approach

Extract the 399-line App.tsx into an **orchestrator shell (~80 lines)** plus **7 focused section components**. Each section owns hooks for its internal concerns (preview, processing, install, batch), while truly shared state stays in the shell via `useState`/`useLocalStorage`. No React Context — props-only. This keeps the data flow explicit, avoids the "fat context" re-render trap, and maps 1:1 to the DOM sections in `App.css`.

| Approach | Verdict |
|----------|---------|
| A — One big Context | ❌ Fat context, hidden deps, all consumers re-render |
| B — Props-only shell | ✅ Chosen — explicit deps, no magic, easy testing |
| C — Zustand/Redux | ❌ Overkill for 6 sections |
| D — Module-level state | ❌ Can't use hooks at module level |

## Architecture Decisions

### Decision: Props-only over Context

| Option | Tradeoff | Decision |
|--------|----------|----------|
| React Context | Fewer prop-drills, but ALL consumers re-render when any value changes (no selector split). Hides deps. | ❌ Rejected |
| **Props-only** | **Explicit interface per component. Easy to test in isolation. Compiler catches missing props.** | ✅ **Chosen** |
| Zustand | Great selector isolation, but adds dep for 6 sections. | ❌ Overkill |

**Rationale**: 6 sections, ~15 shared values, no deeply nested consumers. Props are the simplest contract. If prop-drilling becomes painful later, add context — don't start with it.

### Decision: Hooks move into sections

Every hook moves into the section it serves, EXCEPT `useReaperPath` (mount-once, shared across ReaperPathSection + InstallSection) and `useHsbAdjustments` (shared across Preview, Hsb, Generate, Install sections). These stay in the shell.

## Component Tree

```
App (shell, ~80 lines)
├── HeaderSection          ← static JSX
├── ReaperPathSection      ← reaperPath, installedIcons, onSelectReaperDir (from useReaperPath)
├── SourceSection          ← selectedFile, imageSrc, crop, batchMode, onSelectFile, onCropChange
│   └── ImageCropper       ← imageSrc, onCropChange (existing, untouched)
│   └── BatchPanel         ← (existing, untouched, driven by useBatchProcessing inside SourceSection)
├── PreviewSection         ← selectedFile, crop, padding, isToggle, viewMode, onViewModeChange
│   ├── StatePreview       ← (existing, untouched — receives previewResults from useIconPreview inside PreviewSection)
│   ├── Padding slider     ← inline JSX, driven by padding prop
│   ├── Toggle checkbox    ← inline JSX
│   └── HsbSection         ← offAdjustments, onAdjustments, isToggle, updateOff, updateOn, resetAll
│       └── HsbPanel ×3-6 ← (existing, untouched)
├── InstallSection         ← reaperPath, selectedFile, crop, padding, isToggle, offAdj, onAdj, installedIcons, setInstalledIcons
│   └── InstallPanel       ← (existing, untouched)
└── GenerateSection        ← selectedFile, reaperPath, crop, padding, isToggle, offAdj, onAdj
```

## Section API Contracts

### HeaderSection
```tsx
// Props: none — fully static
```

### ReaperPathSection
```tsx
interface Props {
  reaperPath: DetectionResult | null;
  onSelectReaperDir: () => void;
}
// Own state: none — receives everything
```

### SourceSection
```tsx
interface Props {
  selectedFile: string | null;
  imageSrc: string | null;
  crop: CropArea | null;
  batchMode: boolean;
  onSelectFile: () => void;
  onCropChange: (crop: CropArea | null) => void;
  onBatchModeChange: (enabled: boolean) => void;
  onBatchAddFiles: (files: string[]) => void;
}
// Internal hook: useBatchProcessing
// State owned: batch files, progress, isProcessing (from useBatchProcessing)
```

### PreviewSection
```tsx
interface Props {
  selectedFile: string | null;
  crop: CropArea | null;
  padding: number;
  isToggle: boolean;
  viewMode: 'states' | 'strips';
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onPaddingChange: (p: number) => void;
  onToggleChange: (t: boolean) => void;
  onViewModeChange: (m: 'states' | 'strips') => void;
}
// Internal hooks: useIconPreview, useDebounce ×5
// State owned: previewResults, previewError (from useIconPreview)
```

### HsbSection
```tsx
interface Props {
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  isToggle: boolean;
  updateOff: (index: 0|1|2, adj: HsbAdjustment) => void;
  updateOn: (index: 0|1|2, adj: HsbAdjustment) => void;
  resetAll: () => void;
}
```

### InstallSection
```tsx
interface Props {
  reaperPath: string | null;
  selectedFile: string | null;
  crop: CropArea | null;
  padding: number;
  isToggle: boolean;
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  installedIcons: string[];
  setInstalledIcons: (icons: string[]) => void;
}
// Internal hooks: useIconInstall
// State owned: iconName, installEnabled, previewStrip (from useIconInstall + local state)
```

### GenerateSection
```tsx
interface Props {
  selectedFile: string | null;
  reaperPath: DetectionResult | null;
  crop: CropArea | null;
  padding: number;
  isToggle: boolean;
  offAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  onAdjustments: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
}
// Internal hooks: useIconProcessing
// State owned: processing, processResults, error (from useIconProcessing)
```

## Hook Reorganization

| Hook | Currently | Moves To | Reason |
|------|-----------|----------|--------|
| `useDebounce` (×5) | App shell | `PreviewSection` | Only used to debounce preview params |
| `useIconPreview` | App shell | `PreviewSection` | Only renders into StatePreview |
| `useIconProcessing` | App shell | `GenerateSection` | Only drives generate button + results |
| `useIconInstall` | App shell | `InstallSection` | Only drives InstallPanel |
| `useBatchProcessing` | App shell | `SourceSection` | Only used when batchMode=true |
| `useHsbAdjustments` | App shell | **Stays in shell** | Shared across 4 sections |
| `useReaperPath` | App shell | **Stays in shell** | Mount-once, shared across 2 sections |

No hooks can be merged — each serves a distinct concern.

## Migration Strategy

**One PR, incremental file creation.** Do NOT refactor App.tsx in place.

1. Create `src/sections/` directory
2. Build each section as an independent component file (testable in isolation)
3. Replace inline JSX in App.tsx with section imports, one at a time
4. Run `npx vitest run` after each replacement
5. Delete unused inline JSX and flatten remaining shell

## Testing Impact

**Existing tests MUST pass without changes.** The decomposition preserves:
- All DOM text content, IDs (`#btn-select-icon`, `#btn-process`, `#reaper-path-section`)
- All CSS class names (the sections don't change the className output)
- Mock patterns: `@tauri-apps/api/core`, `@tauri-apps/plugin-dialog`, `../ImageCropper`

The tests render `<App />` and search by text — this won't change.

**New tests needed per section:**
| Component | Test focus |
|-----------|-----------|
| `SourceSection` | Batch toggle, file selection flow |
| `PreviewSection` | Debounced preview, empty/error states |
| `HsbSection` | ON panel visibility per isToggle |
| `InstallSection` | Install button enable/disable |
| `GenerateSection` | Button state, results display |

## Re-Render Analysis

| Trigger | Before | After |
|---------|--------|-------|
| Batch progress tick | Entire App re-renders (399 lines) | Only `SourceSection` (~120 lines) |
| Install preview loading | Entire App re-renders | Only `InstallSection` (~80 lines) |
| Processing (Generating) | Entire App re-renders | Only `GenerateSection` (~60 lines) |
| HSB slider drag | Entire App re-renders | Shell + PreviewSection + HsbSection + InstallSection + GenerateSection (~half) |
| Padding slider change | Entire App re-renders | Shell + PreviewSection + InstallSection + GenerateSection |
| File selection | Entire App re-renders | Shell + SourceSection (PreviewSection/InstallSection conditionally mount) |

**Key win**: Batch, Install preview, and Processing re-renders are fully isolated in their sections.

## Open Questions

- None — every decision is covered above. Execution is mechanical.
