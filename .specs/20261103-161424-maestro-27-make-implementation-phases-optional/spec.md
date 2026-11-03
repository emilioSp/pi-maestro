# MAESTRO-27: Make implementation phases optional

Scope: [proposal.md](proposal.md). Technical decisions: [design.md](design.md).

## Requirements

### REQ1: Configure each agent with a boolean

Delta: added

Add boolean `required` fields to `builder`, `verifier`, and `simplifier` in `.pi/maestro.json`. Reject nonboolean values. Each omitted flag defaults to true, also when its agent section or the file is absent.

Verified by: [AC1](#ac1-nonboolean-flags-are-rejected), [AC2](#ac2-omitted-flags-default-to-true), and the flag combinations exercised by [AC3](#ac3-builder-disabled-completes-at-approval), [AC4](#ac4-disabled-verification-is-bypassed), and [AC5](#ac5-successful-verification-bypasses-disabled-simplification).

#### AC1: Nonboolean flags are rejected

1. Probe: Load configurations with a string, number, or null instead of a boolean for each `required` field.
2. Expected result: Each configuration is rejected as invalid.
3. Example: With `verifier.required: "false"`, loading the configuration fails rather than treating the string as a disabled phase.

#### AC2: Omitted flags default to true

1. Probe: Load configuration with each required flag omitted, with agent sections omitted, and with no configuration file.
2. Expected result: Every omitted flag resolves to true.
3. Example: With `builder.required: false` and no verifier or simplifier sections, the resolved flags are false/true/true; with no configuration file, they are true/true/true.

### REQ2: Skip all implementation when builder is disabled

Delta: modified

With `builder.required: false`, spec approval moves directly from `drafting-spec` to `candidate-ready`. Run no agents, regardless of the other flags.

Verified by: [AC3](#ac3-builder-disabled-completes-at-approval).

#### AC3: Builder disabled completes at approval

1. Probe: Approve a draft with builder disabled, once for each combination of verifier and simplifier flags, and observe workflow completion.
2. Expected result: The saved phase becomes `candidate-ready` without any agent delegation.
3. Example: With flags false/true/true for builder/verifier/simplifier, approval saves `candidate-ready` and starts no agent.

### REQ3: Skip verification independently

Delta: modified

With builder enabled and `verifier.required: false`, builder completion moves directly to `simplifier-running` if simplifier is enabled, otherwise `candidate-ready`. Skip the verifier states and delegation.

Verified by: [AC4](#ac4-disabled-verification-is-bypassed).

#### AC4: Disabled verification is bypassed

1. Probe: Complete builder with verifier disabled, once with simplifier enabled and once with simplifier disabled.
2. Expected result: The workflow bypasses verifier and saves the next selected phase without delegating verifier.
3. Example: With flags true/false/true, builder completion saves `simplifier-running`; with true/false/false, it saves `candidate-ready`. Neither case delegates verifier.

### REQ4: Skip simplification independently

Delta: modified

With `simplifier.required: false`, finishing the preceding phases moves directly to `candidate-ready`. Skip the simplifier state and delegation, also after the owner rejects all current findings.

Verified by: [AC4](#ac4-disabled-verification-is-bypassed), [AC5](#ac5-successful-verification-bypasses-disabled-simplification), [AC6](#ac6-rejected-findings-bypass-disabled-simplification).

#### AC5: Successful verification bypasses disabled simplification

1. Probe: Complete verification without findings with builder and verifier enabled and simplifier disabled.
2. Expected result: The workflow saves `candidate-ready` without entering `simplifier-running` or delegating simplifier.
3. Example: With flags true/true/false, verifier completion with `findings: []` saves `candidate-ready` and starts no simplifier.

#### AC6: Rejected findings bypass disabled simplification

1. Probe: Reject all current findings with builder and verifier enabled and simplifier disabled.
2. Expected result: Finding resolution saves `candidate-ready` without entering `simplifier-running` or delegating simplifier.
3. Example: With flags true/true/false and one current finding V1/F1, rejecting F1 with reason "Outside approved scope" saves `candidate-ready` and starts no simplifier.

### REQ5: Report skipped phases accurately

Delta: modified

The final summary identifies skipped phases without claiming their work was performed.

Verified by: [AC7](#ac7-summary-distinguishes-skipped-work).

#### AC7: Summary distinguishes skipped work

1. Probe: Inspect the final summary for each shortened workflow: spec only, builder only, builder with verifier, and builder with simplifier.
2. Expected result: Each summary identifies skipped phases without claiming their work was performed.
3. Example: With flags false/true/true, the summary reports an approved spec and all three agents skipped, not implemented or verified code.

### REQ6: Check availability only for enabled phases

Delta: modified

At activation, check agent and model availability only for enabled phases. With builder disabled, check only project and configuration: skip all agent and model checks and the pi-subagents ping. With builder enabled, retain the ping.

Verified by: [AC8](#ac8-disabled-later-phases-do-not-block-activation), [AC9](#ac9-spec-only-activation-needs-no-agent-availability), and the existing test in [assertEnvironment.integration.test.ts](../../src/maestro/checks/assertEnvironment.integration.test.ts): "given pi-subagents replies that its availability check failed when activation requirements are checked then the error reports the installation requirement and invalid reply".

#### AC8: Disabled later phases do not block activation

1. Probe: Activate Maestro in a trusted project with valid configuration for flags true/false/true, true/true/false, and true/false/false. In each case, enabled agents and models are available and pi-subagents replies successfully; disabled agents and models are unavailable.
2. Expected result: Activation succeeds in every case.
3. Example: With flags true/false/true, the verifier agent missing, and its configured model absent from Pi's registry, activation succeeds when builder, simplifier, and pi-subagents are available.

#### AC9: Spec-only activation needs no agent availability

1. Probe: Activate Maestro in a trusted project with valid configuration and builder disabled, for each combination of verifier and simplifier flags. All three agents and models are unavailable and no pi-subagents ping responder is present.
2. Expected result: Activation succeeds without sending a pi-subagents availability ping.
3. Example: With flags false/true/true and no available agent models or pi-subagents responder, activation succeeds and sends no availability ping.

## Usage constraint

Set flags before activation and leave configuration unchanged during the workflow. Keep existing configuration reads; add no cache or runtime flag controls.
