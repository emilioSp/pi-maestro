STATUS: DONE

# Task 3: Configure package tooling and CI

## Dependency

This task depends on Task 2: Write the documentation and README.

## Objective

Finish the package metadata, TypeScript setup, Vitest commands, publish boundary, license, ignore rules, and CI workflow.

## Plan references

- Section [5.1](../plan.md#plan-section-5-1), approved `package.json`
- Section [5.2](../plan.md#plan-section-5-2), approved `tsconfig.json`
- Section [6.1](../plan.md#plan-section-6-1), package identity
- Section [6.25](../plan.md#plan-section-6-25), tests
- Section [6.26](../plan.md#plan-section-6-26), compatibility

## Work

1. Align `package.json` with the approved package data.
2. Keep `pi-subagents` 0.68.0 as a dependency and bundled dependency.
3. Declare Pi, `typebox`, and `@earendil-works/pi-ai` as peer dependencies.
4. Keep Vitest only as a development dependency.
5. Use `vitest run test/unit` and `vitest run test/integration` for test scripts.
6. Keep the `imports` field required by project conventions.
7. Align `tsconfig.json` with the source-only ESM design.
8. Write the MIT `LICENSE`.
9. Finalize `.gitignore` without adding `dist/` as a build target.
10. Add macOS and Node.js 26 CI for clean install, typecheck, tests, and `npm pack --dry-run`.
11. Update `package-lock.json` without installing a new dependency.

## Implementation

Do not add a build step or a `dist/` directory. Do not configure publication. CI must only validate the package. Use the already installed Vitest version.

## Tests

Run:

```text
npm run typecheck
npm test
npm pack --dry-run
```

Inspect the dry-run file list and confirm that only approved package content is included.

## Completion criteria

- Local scripts and CI use Vitest.
- Runtime, peer, development, and bundled dependencies are correct.
- The package remains source-only.
- The package dry run succeeds with the expected files.
