# use-local-storage-tests Specification

## Purpose

Unit test coverage for the `useLocalStorage` React hook, verifying CRUD behavior, version schema checks, JSON error handling, storage-full edge cases, and mount/unmount safety using vitest + jsdom native `localStorage`.

## Requirements

### Requirement: Basic Read/Write

The system MUST correctly serialize values to JSON and deserialize them on read.

#### Scenario: Set then get returns stored value

- GIVEN `useLocalStorage` is called with key `"theme"` and default `"dark"`
- WHEN the setter is called with `"light"`
- THEN a subsequent read MUST return `"light"`

#### Scenario: Default value when key is absent

- GIVEN no prior `localStorage` entry exists for key `"lang"`
- WHEN `useLocalStorage` is called with default `"en"`
- THEN the returned value MUST be `"en"`
- AND `localStorage.getItem` MUST NOT have been called for any other key

### Requirement: Overwrite Existing Key

The system MUST overwrite a previously stored value for the same key.

#### Scenario: Overwrite with new value

- GIVEN `localStorage` contains `"{"pref":"a"}"` for key `"userPref"`
- WHEN `useLocalStorage` is called and the setter stores `"{"pref":"b"}"`
- THEN `localStorage.getItem("userPref")` MUST return the new value

### Requirement: Functional Update

The system MUST support a function argument to the setter, receiving the previous value.

#### Scenario: Functional update increments counter

- GIVEN `useLocalStorage("count", 0)` returns value 0
- WHEN the setter is called with `(prev) => prev + 1`
- THEN the stored value MUST become 1

### Requirement: JSON Parse Error → Default

The system MUST return the default value when stored data is malformed JSON.

#### Scenario: Corrupt JSON falls back to default

- GIVEN `localStorage` contains `"not-json"` for the key
- WHEN `useLocalStorage` is called with default `"fallback"`
- THEN the returned value MUST be `"fallback"`
- AND no exception MUST propagate to the caller

### Requirement: Version Mismatch → Default

The system MUST return the default value when stored data has a version field that does not match `PERSISTENCE_VERSION`.

#### Scenario: Stale version schema triggers reset

- GIVEN `localStorage` contains `"{"_version":0,"data":"old"}"` and `PERSISTENCE_VERSION` is 1
- WHEN `useLocalStorage` is called with default `"reset"`
- THEN the returned value MUST be `"reset"`

### Requirement: Storage Full → Silent Fail

The system MUST NOT propagate exceptions when `localStorage.setItem` throws (e.g., quota exceeded).

#### Scenario: Quota exceeded swallowed gracefully

- GIVEN `localStorage.setItem` will throw a `QuotaExceededError`
- WHEN the setter is called with a new value
- THEN no exception MUST propagate to the caller
- AND the in-memory React state MUST still reflect the new value

### Requirement: Multiple Keys

The system MUST support multiple independent `useLocalStorage` hooks with different keys.

#### Scenario: Two keys operate independently

- GIVEN two `useLocalStorage` hooks with keys `"a"` and `"b"`
- WHEN key `"a"` is updated
- THEN key `"b"` MUST retain its original value unchanged

### Requirement: Mount/Unmount Safety

The system MUST NOT leak side effects or throw when a component unmounts before a state update.

#### Scenario: Unmount during update

- GIVEN a component using `useLocalStorage` is mounted
- WHEN the component unmounts while a `setStoredValue` update is pending
- THEN no warnings or errors MUST appear in the console

## Key Decisions / Constraints

- Mock strategy: jsdom native `localStorage` — no manual mocking needed
- Clean `localStorage` between tests via `beforeEach(() => localStorage.clear())`
- Follow existing hook test conventions: vitest + `renderHook` from `@testing-library/react`
- File: `src/hooks/__tests__/useLocalStorage.test.ts`
