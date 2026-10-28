# 20261013-171954-introduce-maestro-at-activation: Introduce Maestro at activation

> After owner approval, this specification is the contract for the builder and verifier.

## 1. Context, goals, and scope

ROADMAP.md R-14 requests a brief introduction when Maestro activates. It invites the owner to ask how Maestro works. Maestro must be able to consult its own documentation to answer those questions.

Extend the existing activation notice and identify the installed documentation in Maestro's active instructions.

### Out of scope

New commands or documentation tools, configuration changes, workflow changes, and automatic loading of all documentation.

## 2. Requirements and constraints

### REQ1: Introduce Maestro before showing agent settings

Keep the existing "Maestro active" heading. Insert these two lines immediately after it, before the existing builder and verifier details:

```text
Maestro helps the owner define a spec, then coordinates implementation and independent verification.
Ask how Maestro works for a short explanation.
```

Verified by: [AC1](#ac1-successful-activation-shows-the-approved-introduction)

### REQ2: Preserve notice styling and show it only on activation

Preserve the configured builder and verifier model and thinking information and existing theme styling. Keep one info notice per successful activation. Failed activation, deactivation, and session resets must not show the introduction.

Verified by: [AC2](#ac2-the-notice-preserves-configured-agent-details); [AC5](#ac5-the-introduction-appears-only-on-successful-activation)

### REQ3: Keep activation UI-only

Activation remains UI-only. It does not start a model request or add conversation history.

Verified by: [AC4](#ac4-activation-does-not-add-conversation-history); [extensions/maestro.integration.test.ts](../../extensions/maestro.integration.test.ts), scenario "given valid activation checks when Maestro is enabled and later re-enabled then its tools, instructions, and status are available without duplicate registration, automatic model calls, or new session history"

### REQ4: Advertise installed documentation through absolute paths

While Maestro is active, its instructions identify absolute paths to the loaded package's `README.md` and `docs/`. The paths must work independently of the owner's project directory.

Verified by: [AC6](#ac6-active-instructions-expose-readable-installed-documentation-paths)

### REQ5: Read documentation on demand without automatic injection

The instructions tell Maestro to read relevant documentation on demand before answering questions about Maestro. Do not automatically insert documentation contents into the instructions. Existing file-reading tools provide access.

Verified by: [AC8](#ac8-documentation-bodies-are-not-automatically-injected)

## 3. Technical decisions

The owner selected an extension of the existing UI-only notice in `extensions/maestro.ts`. This preserves the activation boundaries covered by `extensions/maestro.integration.test.ts`.

The owner selected installed absolute documentation paths in the instructions supplied by `src/maestro/instructions/getMaestroInstructions.ts`. Resolve paths from the loaded package rather than the project directory. `package.json` already ships the required files. `src/specs/template.ts` demonstrates package-relative resource resolution.

No change to the human documentation's intended audience is needed.

## 4. Acceptance criteria

### AC1: Successful activation shows the approved introduction

1. Probe: With Maestro off and valid activation prerequisites, run `/maestro` and inspect the info notice without terminal color sequences.
2. Expected result: Exactly one info notice contains the approved two lines immediately after "Maestro active", before the agent details.
3. Example: In a trusted `/work/shop` project with valid default configuration, run `/maestro`. The notice begins exactly with:

   ```text
   Maestro active
   Maestro helps the owner define a spec, then coordinates implementation and independent verification.
   Ask how Maestro works for a short explanation.
   ```

### AC2: The notice preserves configured agent details

1. Probe: Activate Maestro with explicit, valid model and thinking values. Inspect the notice and its theme styling.
2. Expected result: Both configured model and thinking values remain in their existing themed agent lines.
3. Example: Configure builder model `openai-codex/gpt-6.1-sol` with `xhigh`, and verifier model `openai-codex/gpt-6.1-sol` with `high`. Activate Maestro. The notice retains the accent-styled lines `Builder (openai-codex/gpt-6.1-sol xhigh)` and `Verifier (openai-codex/gpt-6.1-sol high)`, and the muted "Maestro active" heading.

### AC4: Activation does not add conversation history

Run this probe without adding or extending a test in the committed test suite. Record the result in the handoff. Existing tests can remain unchanged.

1. Probe: Record session entries with Maestro off. Activate Maestro successfully and compare the entries.
2. Expected result: The session entries remain unchanged.
3. Example: A session contains an existing owner message "Work on checkout". Run `/maestro`. No entry for the activation heading, introduction, or agent details is added, and all previous entries remain unchanged.

### AC5: The introduction appears only on successful activation

1. Probe: Observe notices during a failed activation, deactivation, a session reset, and a successful reactivation.
2. Expected result: None of the first three actions emits the introduction. Successful reactivation emits it once.
3. Example: With the project untrusted, run `/maestro`. Only the existing activation error appears. With trust and all other prerequisites valid, activate successfully, then run `/maestro` to disable it. No introduction appears on disabling. Reset the session. No introduction appears on reset. Run `/maestro` with valid prerequisites. One introduction appears.

### AC6: Active instructions expose readable installed documentation paths

1. Probe: Load Maestro from a package directory distinct from the project directory. Activate it, inspect its instructions, and read the advertised documentation with an existing file-reading tool.
2. Expected result: The advertised absolute paths identify the loaded package's readable `README.md` and `docs/`, not similarly named project files.
3. Example: Load the package at `/opt/pi-maestro` while Pi runs in `/work/shop`. The project README contains only "Shop project". The instructions identify `/opt/pi-maestro/README.md` and `/opt/pi-maestro/docs/`. Reading the advertised README returns Maestro's README, and reading `workflow.md`, `configuration.md`, `glossary.md`, and `subagent-integration.md` under the advertised directory returns those package documents.

### AC8: Documentation bodies are not automatically injected

Run this probe without adding or extending a test in the committed test suite. Record the result in the handoff. Existing tests can remain unchanged.

1. Probe: With Maestro active, inspect the supplied instructions before any documentation read.
2. Expected result: The instructions contain documentation locations and reading guidance, without embedding the documentation bodies.
3. Example: Activate Maestro in `/work/shop` and submit "Discuss checkout". The Maestro instruction section contains the installed README and docs paths but does not contain the README's "## Prerequisites" section or the configuration document's default JSON block.
