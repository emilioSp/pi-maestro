# 20261013-185941-verify-code-quality-against-agents-md-instructions: Verify code quality against AGENTS.md instructions

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions and prototypes

### Keep the existing finding format

Use existing evidence fields for the instruction file, quote, and violation explanation. No new schema fields or automatic quote validation are required.

`src/artifacts/verifier-handoff/schema.ts` supports these details through `evidence.source` and `evidence.observation`. It also permits `acceptanceCriterion: null` when no specific criterion applies. Existing owner decisions remain unchanged.

### Verification boundary

This change concerns written guidance. Acceptance probes inspect that guidance against the concrete scenarios in [spec.md](spec.md). They do not require additional model runs or changes to project tests.
