STATUS: DONE

# Task 5: Implement configuration

## Dependency

This task depends on Task 4: Build shared test support.

## Objective

Load and validate optional project configuration with complete defaults.

## Plan references

- Sections [2.5](../plan.md#plan-section-2-5), [2.6](../plan.md#plan-section-2-6), and [2.9](../plan.md#plan-section-2-9)
- Sections [6.4](../plan.md#plan-section-6-4) through [6.7](../plan.md#plan-section-6-7)
- Section [6.20](../plan.md#plan-section-6-20), configuration activation check

## Work

1. Implement defaults in `src/config/defaults.ts`.
2. Implement the closed TypeBox schema and validation in `src/config/validate.ts`.
3. Implement `.pi/maestro.json` loading and override merging in `src/config/load.ts`.
4. Configure subpath imports for direct module access without an export barrel.
5. Report missing version, unsupported version, unknown fields, invalid model identifiers, invalid thinking values, and invalid timeouts precisely.

## Implementation

A missing file returns all defaults. An existing file requires `version: "1.0.0"`; every other field is optional. Validate `version` as Semantic Versioning and reject invalid or unsupported versions, including unsupported major versions. Merge nested builder and verifier overrides without losing sibling defaults. Accept only full `provider/model` identifiers and integer timeouts from 1 to 1440. Do not check path safety, model availability, or Pi UI here.

## Tests

Add Vitest unit tests mirroring `src/config/`. Cover defaults, partial overrides, invalid JSON, unknown fields at every level, unsupported versions, model format, thinking enum, timeout bounds, and no mutation of defaults.

## Completion criteria

- Valid partial configuration produces a complete immutable result.
- Every invalid configuration returns a useful error.
- Configuration code has no Pi or Git dependency.
