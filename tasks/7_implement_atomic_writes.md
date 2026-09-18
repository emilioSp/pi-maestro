STATUS: TODO

# Task 7: Implement atomic file writes

## Dependency

This task depends on Task 6: Implement safe paths and spec IDs.

## Objective

Provide one safe file-writing primitive for workflow state and JSON artifacts.

## Plan references

- Section [5](../plan.md#plan-section-5), `src/atomic-write.ts`
- Sections [2.11](../plan.md#plan-section-2-11), [6.14](../plan.md#plan-section-6-14), and [6.15](../plan.md#plan-section-6-15)

## Work

1. Implement `src/atomic-write.ts`.
2. Write content to a temporary file in the destination directory.
3. Flush and rename the temporary file to the final path.
4. Preserve the existing destination if writing fails.
5. Clean temporary files after success or failure.
6. Support the UTF-8 text and formatted JSON writes needed by later modules.

## Implementation

Keep the API Pi-independent. Require callers to provide already validated paths and already validated data. Use unique temporary names that cannot collide between concurrent attempts. Do not use a shell command.

## Tests

Add Vitest unit tests for a new file, replacing a file, Unicode content, simulated write failure, simulated rename failure, concurrent temporary names, and temporary-file cleanup.

## Completion criteria

- Readers never observe a partially written destination.
- A failed write does not destroy the previous content.
- No temporary file remains after the operation.
