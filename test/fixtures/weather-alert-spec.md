# <id>: Enable weather alerts

## 1. Context, goals, and scope

The test repository has no weather alert message. Add one fixed message.

### Measurable goals

The file `alert.txt` contains exactly `Weather alerts enabled` followed by a newline.

### Out of scope

No weather service, user interface, or configuration changes.

## 2. Requirements and constraints

### Functional requirements

Create `alert.txt` in the repository root with the required message.

### Non-functional requirements

No additional non-functional requirements.

### Constraints

Use the current checkout and branch. Do not change the approved specification.

### Edge cases and error handling

No additional edge cases.

## 3. Technical design

No architectural changes. The product is one text file.

## 4. Acceptance criteria

### AC1: The weather alert message is available

1. Probe: Read `alert.txt` as UTF-8 and compare it with `Weather alerts enabled\n`.
2. Expected result: The contents match exactly.
3. Breakage: Replace `enabled` with `disabled`. The contents no longer match. Restore the message before the handoff.
