# error-reporting Specification

## Purpose

Capture Rust panics and React render errors, persisting them to a rotating log file in the app data directory for debugging without external services.

## Requirements

### Requirement: Rust Panic Capture

The Rust backend MUST register a panic hook via `panic::set_hook` that writes the panic message and backtrace to `{app_data_dir}/error.log`.

#### Scenario: Rust panic writes to error log

- GIVEN the application is running
- WHEN a Rust thread panics
- THEN the panic message and backtrace MUST be written to `{app_data_dir}/error.log`
- AND the application MUST NOT silently swallow the backtrace

### Requirement: Frontend Error Persistence

The React ErrorBoundary MUST catch unhandled render errors and persist them via Tauri IPC invoke to the same `{app_data_dir}/error.log`.

#### Scenario: React render crash persists to log

- GIVEN a React component throws during rendering
- WHEN the ErrorBoundary catches the error
- THEN the ErrorBoundary MUST invoke the Rust backend to write the error details to `error.log`

### Requirement: Log Rotation

The error log MUST NOT exceed 1 MB. The system MUST cap error entries at 5 per session, silently dropping subsequent errors.

#### Scenario: Log exceeds size limit

- GIVEN the error log file exceeds 1 MB
- WHEN a new error is written
- THEN the oldest entries MUST be truncated to keep the file under 1 MB

#### Scenario: Error cap prevents unbounded growth

- GIVEN 5 errors have been logged in the current session
- WHEN a 6th error occurs
- THEN the error MUST be silently dropped
- AND it MUST NOT appear in the log file
