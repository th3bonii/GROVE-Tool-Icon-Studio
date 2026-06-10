# Delta for app-shell

## ADDED Requirements

### Requirement: App Shell Decomposition

The App shell SHALL decompose into 5 section components. Each section MUST own its local state and side-effect hooks. The App SHALL act as a thin layout container providing shared context.

#### Scenario: Rendering isolation

- GIVEN the App shell renders ReaperPathSection, SourceIconSection, CropPreviewSection, InstallSection, and GenerateSection
- WHEN a state change occurs in CropPreviewSection (e.g., crop adjustment)
- THEN only CropPreviewSection MUST re-render
- AND the other 4 sections MUST NOT re-render

#### Scenario: Batch processing doesn't re-render preview

- GIVEN batch files change in SourceIconSection
- WHEN useBatchProcessing updates file status
- THEN only SourceIconSection MUST re-render
- AND CropPreviewSection, InstallSection, and GenerateSection MUST NOT re-render

### Requirement: Shared AppContext

The system MUST provide a React Context (AppContext) for state consumed by multiple sections. State that is owned and consumed by a single section MUST remain local to that section.

#### Scenario: ReaperPath context dependency

- GIVEN ReaperPathSection detects the REAPER path
- WHEN InstallSection needs the path for install targets
- THEN InstallSection MUST read `reaperPath` from AppContext

### Requirement: Section Contracts

Each section MUST accept zero props or only unique local-config inputs. All shared state MUST be consumed from AppContext.

#### Scenario: Sections read from context

- GIVEN CropPreviewSection renders
- WHEN it needs crop, padding, isToggle, selectedFile, and HSB adjustments
- THEN it MUST read them from AppContext
- AND it MUST NOT receive them as App props

#### Scenario: REAPER path change isolates dependencies

- GIVEN the REAPER path changes in ReaperPathSection
- WHEN the path updates in AppContext
- THEN InstallSection and GenerateSection MUST read the new path from context
- AND SourceIconSection and CropPreviewSection MUST NOT re-render

#### Scenario: Generate results don't re-render other sections

- GIVEN GenerateSection completes processing
- WHEN processResults updates in GenerateSection's local state
- THEN only GenerateSection MUST re-render
- AND SourceIconSection, CropPreviewSection, and InstallSection MUST NOT re-render

### Requirement: Backward-Compatible Export

The App module MUST export a default component that is externally identical to the current `<App />` component. All existing tests that render `<App />` MUST pass without import changes.

#### Scenario: Existing App tests pass unchanged

- GIVEN `App.test.tsx`, `App-Batch.test.tsx`, and `App-HSB.test.tsx` import `App from '../App'`
- WHEN the decomposition is complete
- THEN all 3 test files MUST pass without any import changes
- AND `render(<App />)` MUST render the complete 5-section UI

## MODIFIED Requirements

### Requirement: Main Interface

The system MUST provide a UI composed of 5 independently-renderable section components (ReaperPathSection, SourceIconSection, CropPreviewSection, InstallSection, GenerateSection) orchestrated by a thin App shell. The App shell MUST NOT exceed 120 lines.
(Previously: monolithic App.tsx with all rendering inline, ~400 lines)

#### Scenario: App shell renders all sections

- GIVEN the application is running
- WHEN the App shell renders
- THEN it MUST include ReaperPathSection, SourceIconSection, CropPreviewSection, InstallSection, and GenerateSection
- AND the App shell MUST be under 120 lines

## State Ownership

### AppContext (shared across sections)
| State | Consumers |
|-------|-----------|
| reaperPath, installedIcons | ReaperPath, Install, Generate |
| selectedFile, imageSrc | SourceIcon, CropPreview, Generate |
| crop | CropPreview, Generate, Install |
| padding, isToggle | CropPreview, Generate, Install |
| offAdjustments, onAdjustments, updateOff, updateOn, resetAll | CropPreview, Generate, Install |
| processing (lock flag) | Install, Generate |

### Local State (owned by section, NOT in context)
- **ReaperPathSection**: `useReaperPath` (detection, handleSelectReaperDir)
- **SourceIconSection**: `useBatchProcessing` (batchFiles, batchProgress), batchMode toggle, handleSelectFile
- **CropPreviewSection**: `useIconPreview` (previewResults, previewError), viewMode, padding slider, toggle checkbox
- **InstallSection**: `useIconInstall` (iconName, installEnabled), previewStrip, previewIconName
- **GenerateSection**: `useIconProcessing` (processResults, processError, handleGenerate)
