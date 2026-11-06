# Migrate builder, verifier, and simplifier to the Pi SDK

Scope: [proposal.md](proposal.md). Technical decisions: [design.md](design.md).

## Requirements

### REQ1: Maestro MUST execute the builder through the existing internal Pi SDK executor

Delta: modified

Before: `maestro_run_builder` sends a `pi-subagents` delegation request.

The task prompt includes the spec ID and project directory. Other inputs: canonical working directory, builder model and thinking level, builder guidance, the three handoff tools from REQ8, and the original run-tool cancellation signal.

Verified by:
1. [AC1](#ac1-builder-uses-the-configured-sdk-inputs).
2. [Builder phase selection](../../src/tools/main/run-builder.integration.test.ts): `given verifier disabled and simplifier=$simplifier when builder completes then $phase is saved without verifier delegation`.
3. [Spec-only approval](../../src/tools/main/mark-spec-ready.integration.test.ts): `given builder disabled with verifier=$verifier and simplifier=$simplifier when the draft is approved then candidate-ready is saved without delegation`.

#### AC1: Builder uses the configured SDK inputs

GIVEN: An approved spec in `ready-for-builder`, builder model `openai-codex/gpt-6.1-sol`, thinking level `high`, and a supplied run-tool cancellation signal.

WHEN: `maestro_run_builder` starts the builder.

THEN: `executeTask` receives the builder's execution inputs.

Example: For spec `20261106-100000-weather-alerts`, `executeTask` receives a builder prompt containing that ID and `/projects/weather`, `cwd: /projects/weather`, model `openai-codex/gpt-6.1-sol`, thinking level `high`, builder guidance, the three handoff tool definitions, and the original run-tool `AbortSignal`.

### REQ13: Maestro MUST execute the verifier through the existing internal Pi SDK executor

Delta: modified

Before: `maestro_run_verifier` sends a `pi-subagents` delegation request.

The task prompt includes the spec ID and project directory. Other inputs: canonical working directory, verifier model and thinking level, verifier guidance, the three handoff tools from REQ8, and the original run-tool cancellation signal.

Verified by:
1. [AC2](#ac2-verifier-uses-the-configured-sdk-inputs).
2. [Verifier phase selection](../../src/tools/main/run-verifier.integration.test.ts): `given simplifier disabled when verification completes without findings then candidate-ready is saved without simplifier delegation`.

#### AC2: Verifier uses the configured SDK inputs

GIVEN: A spec in `ready-for-verifier`, verifier model `openai-codex/gpt-6-astra`, thinking level `medium`, and a supplied run-tool cancellation signal.

WHEN: `maestro_run_verifier` starts the verifier.

THEN: `executeTask` receives the verifier's execution inputs.

Example: For spec `20261106-100000-weather-alerts`, `executeTask` receives a verifier prompt containing that ID and `/projects/weather`, `cwd: /projects/weather`, model `openai-codex/gpt-6-astra`, thinking level `medium`, verifier guidance, the three handoff tool definitions, and the original run-tool `AbortSignal`.

### REQ14: Maestro MUST execute the simplifier through the existing internal Pi SDK executor

Delta: modified

Before: `maestro_run_simplifier` sends a `pi-subagents` delegation request.

The task prompt includes the spec ID and project directory. Other inputs: canonical working directory, simplifier model and thinking level, simplifier guidance, the three handoff tools from REQ8, and the original run-tool cancellation signal.

Verified by:
1. [AC3](#ac3-simplifier-uses-the-configured-sdk-inputs).
2. [Simplifier execution](../../src/tools/main/run-simplifier.integration.test.ts): `given a Git project ready for simplification when the simplifier saves its report then one run uses its configured model and project and returns candidate-ready with that report`.
3. [Full workflow](../../extensions/maestro.integration.test.ts): `given an approved proposal, nested-criteria spec, and design in Git when builder, verifier, and simplifier finish then the workflow ends at candidate-ready with saved reports and unchanged approved documents`.

#### AC3: Simplifier uses the configured SDK inputs

GIVEN: A spec in `simplifier-running` in a Git project, simplifier model `openai-codex/gpt-6.1-sol`, thinking level `high`, and a supplied run-tool cancellation signal.

WHEN: `maestro_run_simplifier` starts the simplifier.

THEN: `executeTask` receives the simplifier's execution inputs.

Example: For spec `20261106-100000-weather-alerts` in Git project `/projects/weather`, `executeTask` receives a simplifier prompt containing that ID and directory, `cwd: /projects/weather`, model `openai-codex/gpt-6.1-sol`, thinking level `high`, simplifier guidance, the three handoff tool definitions, and the original run-tool `AbortSignal`.

### REQ4: Maestro MUST activate without pi-subagents availability or launch-contract checks

Delta: removed

Before: Activation resolves enabled agents through `pi-subagents` and requires its ping response.

Use existing activation coverage; no new test solely for this deletion.

Verified by: removal review of [activation checks](../../src/maestro/checks/assertEnvironment.ts) and the [existing activation test](../../extensions/maestro.integration.test.ts), scenario:
`given valid activation checks when Maestro is enabled and later re-enabled then its tools, instructions, and status are available without duplicate registration, automatic model calls, or new session history`.

### REQ5: Maestro MUST reuse the bundled Markdown instructions for each role

Delta: modified

Sources: `agents/builder.md`, `agents/verifier.md`, and `agents/simplifier.md` from the executing Maestro package. No alternative role-instruction source or `pi-subagents` override discovery. Each role's Markdown instructions are added to Pi's normal instructions through the existing executor; they do not replace them.

Verified by: [AC4](#ac4-each-role-receives-its-bundled-instructions).

#### AC4: Each role receives its bundled instructions

GIVEN: The executing Maestro package contains the three bundled role instruction files.

WHEN: Each role starts through its run tool.

THEN: Its effective SDK system prompt contains Pi's normal instructions plus that role's complete bundled Markdown instruction body.

Example: Starting the builder retains Pi's normal instructions and adds the complete body beginning `# Builder` from `agents/builder.md`; the verifier and simplifier receive the corresponding bodies beginning `# Verifier` and `# Simplifier`.

### REQ6: Maestro MUST supply its three role instruction files without frontmatter

Delta: removed

Before: The three role files contain `pi-subagents` discovery and execution settings in YAML frontmatter.

Required files: `agents/builder.md`, `agents/verifier.md`, and `agents/simplifier.md`. Their Markdown bodies remain the role instructions.

Verify by manual inspection; do not add a test solely to assert that frontmatter is absent.

Verified by: [AC5](#ac5-role-files-contain-only-markdown-instructions).

#### AC5: Role files contain only Markdown instructions

GIVEN: The three bundled role files.

WHEN: Their contents are manually inspected after migration.

THEN: Each file contains its existing Markdown instruction body without the YAML frontmatter block.

Example: `agents/builder.md` begins with `# Builder`, not `---`; its existing instruction body follows without the former `name`, `package`, or execution settings.

### REQ7: Maestro MUST have no code dependency on pi-subagents

Delta: removed

Before: Source and tests import `pi-subagents` APIs.

Removal includes imports, obsolete delegation and preflight code, and test coupling. No compatibility readers, adapters, or engine selectors.

Verify code cleanup by manual inspection; do not add tests solely to assert that imports are absent.

Verified by: [AC6](#ac6-source-and-tests-no-longer-import-pi-subagents).

#### AC6: Source and tests no longer import pi-subagents

GIVEN: The migrated source, extensions, and tests.

WHEN: Their dependency imports are manually inspected.

THEN: No module imports `pi-subagents` or its subpaths.

Example: The run tools and activation checks no longer import `pi-subagents/delegation` or `pi-subagents/preflight`, and the test suite has no imports from those modules.

### REQ8: Maestro MUST supply existing handoff tools directly to SDK child sessions

Delta: modified

Before: Role frontmatter loads `extensions/maestro-subagent.ts`, which registers the three handoff tools.

Supply `maestro_record_builder_handoff`, `maestro_record_verifier_handoff`, and `maestro_record_simplifier_handoff` through the executor's additional tools. Saved handoffs and workflow state determine the role outcome, not returned assistant text.

Verified by: [AC1](#ac1-builder-uses-the-configured-sdk-inputs), [AC2](#ac2-verifier-uses-the-configured-sdk-inputs), [AC3](#ac3-simplifier-uses-the-configured-sdk-inputs), [AC7](#ac7-sdk-child-text-cannot-replace-a-handoff).

#### AC7: SDK child text cannot replace a handoff

GIVEN: Each role starts in its valid entry phase and its SDK child records no terminal handoff.

WHEN: The SDK execution returns normally with the text `Completed successfully`.

THEN: The run tool reports a role-specific protocol error rather than successful completion.

Example: A builder starting from `ready-for-builder` returns `Completed successfully` without recording `B1.json`; `maestro_run_builder` reports a builder protocol error. Repeat for a verifier starting from `ready-for-verifier` and a simplifier starting from `simplifier-running` in a Git project.

### REQ9: Maestro MUST show the owner the saved native child session path on completion or failure

Delta: added

Applicable to all three role tools, including execution errors, interruptions, and post-execution protocol errors. Display only an existing path reported by the executor; do not invent a path when none exists. Use normal Pi tool output or UI notices, without a custom renderer or transcript viewer.

Verified by: [AC8](#ac8-completed-runs-show-the-saved-session-path), [AC9](#ac9-failed-runs-show-the-saved-session-path).

#### AC8: Completed runs show the saved session path

GIVEN: Each role's SDK execution completes with a valid saved handoff and an existing native session file.

WHEN: Its run tool returns the validated outcome.

THEN: The owner-visible output includes the exact saved session path.

Example: When the executor reports `/sessions/weather/subagents/child.jsonl`, the completed builder output displays `/sessions/weather/subagents/child.jsonl`. Repeat for completed verifier and simplifier runs.

#### AC9: Failed runs show the saved session path

GIVEN: A native child session file exists for a run that encounters a model execution error, an interruption, or a post-execution protocol error.

WHEN: The role tool reports that failure.

THEN: The owner-visible output includes the exact saved session path.

Example: A child model error `Provider unavailable` with saved file `/sessions/weather/subagents/child.jsonl` displays that path. Exercise the same path disclosure for cancellation and for normal SDK completion without a required handoff, across all three roles.

### REQ11: Maestro MUST use the SDK without an execution timeout

Delta: removed

Before: `pi-subagents` delegation supplied a fixed execution deadline.

No replacement Maestro timeout. Pi and tool-internal timeouts are outside this removal.

Verified by: manual inspection of the [role run tools](../../src/tools/main/) and [SDK executor](../../src/delegation/executeTask.ts). No elapsed-time test.

### REQ12: Maestro documentation MUST describe the SDK workflow for the owner

Delta: modified

`README.md` and `docs/`: installation, configuration, running agents, cancellation, and inspecting or exporting saved sessions. Describe owner actions, not agent procedures or internal executor APIs. Update affected tech-stack descriptions. Historical records stay outside this cleanup.

Verified by: [AC10](#ac10-documentation-describes-owner-workflows).

#### AC10: Documentation describes owner workflows

GIVEN: The updated `README.md` and `docs/`.

WHEN: Installation and agent-use instructions are read from the owner's perspective.

THEN: They explain the owner-facing SDK workflow without requiring `pi-subagents` setup or internal API procedures.

Example: The guide explains installation with `pi install npm:@emiliosp/pi-maestro`, activation with `/maestro`, and inspecting a displayed session path such as `/sessions/weather/subagents/child.jsonl` with `pi --export /sessions/weather/subagents/child.jsonl conversation.html`.
