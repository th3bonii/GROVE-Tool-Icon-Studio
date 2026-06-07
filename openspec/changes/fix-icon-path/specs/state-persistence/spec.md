# state-persistence Specification

## Purpose

Generic localStorage-based hook for persisting user session state across app restarts, covering HSB adjustments, UI controls, and REAPER path preferences.

## Requirements

### Requirement: Generic Persistence Hook

The system MUST provide a `useLocalStorage<T>` generic hook that reads from and writes to localStorage with JSON serialization.

#### Scenario: Save and restore across refresh

- GIVEN a key-value pair is persisted via the hook
- WHEN the page is reloaded
- THEN the hook MUST return the previously saved value as initial state

#### Scenario: Type-safe interface

- GIVEN the hook is used with a TypeScript type `T`
- WHEN reading from localStorage
- THEN the returned value MUST conform to type `T`

### Requirement: Versioned Schema

The persisted state MUST include a version field (integer) and support initial migration upon schema drift.

#### Scenario: Schema version mismatch discards stale state

- GIVEN stored state has version 1
- WHEN the current schema expects version 2
- THEN the hook MUST discard stale state
- AND return the default initial value

### Requirement: Persisted State Shape

The persisted state MUST include: offAdjustments, onAdjustments, padding, isToggle, viewMode, reaperPath, iconName, installEnabled.

#### Scenario: Full state round-trip

- GIVEN the user configures all 8 persisted settings
- WHEN the state is saved and the page is reloaded
- THEN all fields MUST be restored to their saved values
- AND the version field MUST be present in the stored record

#### Scenario: Partial or corrupted state fallback

- GIVEN localStorage has a partial or corrupted record
- WHEN the hook initializes
- THEN missing fields MUST fall back to their defaults
- AND the application MUST NOT crash
