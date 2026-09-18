STATUS: TODO

# Task 1: Initialize the package structure

## Dependency

This task has no task dependency.

## Objective

Create the frozen MVP directory and file structure before any feature work starts.

## Plan references

- Section [5](../plan.md#plan-section-5), `Struttura approvata del pacchetto`
- Section [5.1](../plan.md#plan-section-5-1), approved package manifest
- Section [5.2](../plan.md#plan-section-5-2), approved TypeScript configuration

## Work

1. Create every directory and file listed in the approved tree.
2. Keep the existing root files.
3. Add one short module-purpose comment to each new TypeScript file.
4. Add simple placeholders to new Markdown, YAML, and template files.
5. Keep every `src/**/index.ts` file as an export barrel placeholder.
6. Do not add files or directories that are not in the approved tree.
7. Do not add `.gitkeep` files. Empty test directories may appear only when later tasks add tests or fixtures.

## Implementation

Use the exact names and nesting from the plan. A placeholder must describe the future responsibility of the file, but it must not implement behavior. Do not add exports that refer to modules which are not implemented yet.

## Tests

1. Compare the created paths with the approved tree.
2. Run `npm run typecheck`.
3. Confirm that no `dist/` directory exists.

## Completion criteria

- Every approved structural file exists.
- Every new TypeScript file has a useful placeholder comment.
- The TypeScript check passes.
- No unapproved structural path was added.
