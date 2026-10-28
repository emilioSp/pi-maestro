# 20261013-171954-introduce-maestro-at-activation: Introduce Maestro at activation

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions

The owner selected an extension of the existing UI-only notice in `extensions/maestro.ts`. This preserves the activation boundaries covered by `extensions/maestro.integration.test.ts`.

The owner selected installed absolute documentation paths in the instructions supplied by `src/maestro/instructions/getMaestroInstructions.ts`. Resolve paths from the loaded package rather than the project directory. `package.json` already ships the required files. `src/specs/template.ts` demonstrates package-relative resource resolution.

No change to the human documentation's intended audience is needed.
