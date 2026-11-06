# 20261106-172339-simplify-sdk-agent-progress-to-elapsed-time-and-assistant-text: Simplify SDK agent progress to elapsed time and assistant text

Scope: [proposal.md](proposal.md).

## Requirements

### REQ1: Maestro MUST show only elapsed time and assistant text in run progress

Delta: modified

Before: each progress update showed the role name, elapsed time, the names of any running tools, and the latest normal assistant text, joined by `|` separators.

The role name, the tool list, and the empty-text placeholder wording are no longer part of the progress content. Elapsed time keeps its current `Xm Ys` format and
the latest normal assistant text keeps following a blank line when it exists.

Verified by: [AC1](#ac1-progress-shows-elapsed-time-and-recent-assistant-text), [AC2](#ac2-progress-omits-role-and-tool-identity), [AC3](#ac3-progress-omits-assistant-text-until-some-exists)

#### AC1: Progress shows elapsed time and recent assistant text

- GIVEN an executing builder whose latest normal assistant text is "Running the tests."
- WHEN the run publishes a progress update 134 seconds after it started.
- THEN the update text is `Elapsed: 2m 14s`, a blank line, and "Running the tests.".
- Example: The builder emits "Running the tests." at 134 seconds. The published text is exactly `Elapsed: 2m 14s\n\nRunning the tests.`. The verifier and
  simplifier produce the same form.

#### AC2: Progress omits role and tool identity

- GIVEN an executing builder that started the bash tool and whose latest normal assistant text is "Running the tests.".
- WHEN the run publishes a progress update.
- THEN the text contains neither a role name nor a tool name.
- Example: At 134 seconds with bash running, the published text is `Elapsed: 2m 14s\n\nRunning the tests.`. It contains neither "Builder" nor "bash", and no
  `Active tool` field.

Verification: checked against the published text without a dedicated automated test.

#### AC3: Progress omits assistant text until some exists

- GIVEN a run that just started and emitted no assistant text.
- WHEN the run publishes its initial progress update.
- THEN the update text is the elapsed time alone.
- Example: A verifier starts and publishes `Elapsed: 0m 0s`. No separator or placeholder follows the duration.

### REQ2: Maestro MUST NOT track child tool execution for progress

Delta: removed

Before: activity tracking kept a map of running tool calls, updated on tool execution start and end, and the progress content listed their names.

Tool execution start and end events no longer change tracked activity or publish a progress update. The latest normal assistant text stays visible through tool
execution and periodic refreshes, as before.

Verified by: [AC4](#ac4-tool-events-publish-no-progress-update)

#### AC4: Tool events publish no progress update

- GIVEN an executing builder whose latest normal assistant text is "Running the tests.".
- WHEN the child starts and finishes bash without emitting new assistant text.
- THEN neither tool event publishes a progress update, and the displayed text is unchanged.
- Example: At 134 seconds the view shows `Elapsed: 2m 14s\n\nRunning the tests.`. Bash starts and finishes; no update is published for either event. The next
  periodic refresh publishes `Elapsed: 2m 39s\n\nRunning the tests.`.

## Assumptions

- The `Elapsed: ` prefix, the `Xm Ys` format, and the blank line before assistant text are kept.
- The periodic refresh cadence, Pi's presentation, and the reasoning and tool-result exclusions are unchanged.
