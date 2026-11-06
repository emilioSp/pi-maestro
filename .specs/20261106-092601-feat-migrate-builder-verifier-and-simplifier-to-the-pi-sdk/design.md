# Migrate builder, verifier, and simplifier to the Pi SDK

## Decisions

1. Use the accepted `executeTask` operation for all three roles, following [ADR-010](../../ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation). No second executor or engine selector. Apply DRY where it improves simplicity and code readability; do not force a shared abstraction.
2. Load role guidance directly from the executing package's existing `agents/builder.md`, `agents/verifier.md`, and `agents/simplifier.md`. The owner selected reuse of these files without another role-instruction source. See [REQ5](spec.md#req5-maestro-must-reuse-the-bundled-markdown-instructions-for-each-role).
3. Remove role frontmatter with MAESTRO-FREE-7. No parser or replacement metadata format is needed. See [REQ6](spec.md#req6-maestro-must-supply-its-three-role-instruction-files-without-frontmatter).
4. Keep the existing SDK prompt composition: Pi's normal instructions plus role guidance. The owner selected this instead of reproducing the old `systemPromptMode: replace` setting. Reason: reuse the accepted executor without another prompt-loading mechanism.

## Contracts and references

1. [Executor](../../src/delegation/executeTask.ts): prompt, role guidance, project directory, model, thinking level, additional tools, and optional cancellation signal; returns final text and an optional saved session path.
2. [Session lifecycle](../../src/delegation/SubSession.ts): fresh native child sessions, cancellation, cleanup, and saved-session discovery.
3. [Resource loading](../../src/delegation/createChildServices.ts): native Pi discovery and role-guidance composition, excluding the main Maestro extension.

## Risks and limits

1. Native resource loading does not guarantee compatibility with arbitrary third-party extensions; ADR-010 defines this boundary.
2. Frontmatter removal does not move its old execution settings into a new configuration system.
3. Live activity presentation remains MAESTRO-FREE-6.
