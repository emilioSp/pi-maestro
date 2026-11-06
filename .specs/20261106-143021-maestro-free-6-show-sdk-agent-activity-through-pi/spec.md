# MAESTRO-FREE-6: Show SDK agent activity through Pi

Scope: [proposal.md](proposal.md).

## Requirements

### REQ1: Maestro MUST show live child activity for each executing role

Delta: added

1. Apply to builder, verifier, and simplifier runs.
2. Show the role, elapsed run time, active tool name when available, and latest normal assistant message as it streams.
3. Keep the latest assistant text visible during tool execution until newer normal assistant text replaces it.
4. Indicate no active tool when none is executing; omit assistant text until some exists.
5. Start each run with its own elapsed time and activity, without previous-run text or tool state.

Verified by: [AC1](#ac1-activity-identifies-each-role), [AC2](#ac2-assistant-text-streams-into-the-view), [AC3](#ac3-finished-tools-are-not-shown-as-active), [AC4](#ac4-a-new-run-starts-with-fresh-activity).

#### AC1: Activity identifies each role

1. GIVEN an executing builder, verifier, or simplifier.
2. WHEN the child emits "Running the tests." and starts the bash tool.
3. THEN its activity view identifies that role, elapsed time, bash as active, and "Running the tests." as recent assistant text.
4. Example: A verifier has run for 134 seconds, emits "Running the tests.", and starts bash. Its view contains Verifier, an elapsed duration equivalent to 2 minutes 14 seconds, bash, and "Running the tests.". The same scenario applies to Builder and Simplifier.

#### AC2: Assistant text streams into the view

1. GIVEN an active child streaming a normal assistant message.
2. WHEN another text fragment arrives before the message finishes.
3. THEN the view shows the accumulated text of that message without waiting for completion.
4. Example: The child streams "Checking " followed by "validation." while the message remains open. The view shows "Checking validation.".

#### AC3: Finished tools are not shown as active

1. GIVEN bash is the child's only active tool.
2. WHEN bash finishes and no other tool starts.
3. THEN the view indicates no active tool.
4. Example: Bash finishes at 140 seconds and the child waits for the model. The next activity refresh no longer identifies bash as executing.

#### AC4: A new run starts with fresh activity

1. GIVEN a completed builder run whose last text was "Build complete." and whose last tool was bash.
2. WHEN a verifier run starts before emitting assistant text or starting a tool.
3. THEN its initial activity contains only the new run's state.
4. Example: After a 180-second builder run, the verifier starts at elapsed zero with no active tool and no "Build complete." text.

### REQ2: Maestro MUST refresh elapsed activity during silent execution

Delta: added

1. Continue periodic elapsed-time updates while the child produces no assistant text or tool events.

Verified by: [AC5](#ac5-elapsed-time-advances-without-child-events), [AC8](#ac8-progress-does-not-become-model-input).

#### AC5: Elapsed time advances without child events

1. GIVEN an active child whose view shows an elapsed duration of 134 seconds.
2. WHEN 25 seconds pass without assistant text or tool events and the periodic refresh occurs.
3. THEN the view shows an elapsed duration equivalent to 159 seconds.
4. Example: Bash remains active without output. The elapsed display advances from 2 minutes 14 seconds to 2 minutes 39 seconds despite receiving no new child events.

### REQ3: Maestro MUST present activity through Pi's standard tool-progress display

Delta: added

1. Send updates through the executing run tool's onUpdate callback.
2. Replace the same progress content in place.
3. Leave layout, truncation, and expansion to Pi; add no custom renderer, fixed line count, or terminal-height adaptation.
4. Display only role, elapsed time, tool identity, and normal assistant text; exclude thinking blocks and tool-result bodies.

Verified by: [AC6](#ac6-progress-updates-the-same-native-tool-view), [AC7](#ac7-progress-excludes-thinking-and-tool-results).

#### AC6: Progress updates the same native tool view

1. GIVEN a run displayed through Pi's standard tool presentation.
2. WHEN multiple activity updates arrive, including assistant text longer than Pi's collapsed preview.
3. THEN the same tool view displays the latest update using Pi's native truncation and expansion.
4. Example: The child first emits "Checking files." and then a 30-line normal assistant message. One running tool view shows the newer message; Pi controls its collapsed preview and expansion rather than Maestro imposing a line limit.

#### AC7: Progress excludes thinking and tool results

1. GIVEN a child emitting normal assistant text, thinking blocks, and tool results.
2. WHEN those events are processed for activity.
3. THEN the progress content includes only the permitted activity fields.
4. Example: Assistant text is "Running checks.", a thinking block contains "PRIVATE_REASONING_123", and bash returns "RAW_OUTPUT_456". Activity can show "Running checks." and bash, but contains neither sentinel.

### REQ4: Maestro MUST keep intermediate activity out of model input

Delta: added

1. Do not append progress as messages to the main conversation or merge it into the final workflow result.
2. Do not send model requests or prompts to create progress.

Verified by: [AC8](#ac8-progress-does-not-become-model-input).

#### AC8: Progress does not become model input

1. GIVEN a child whose intermediate normal assistant text contains "PROGRESS_ONLY_789", absent from its final handoff.
2. WHEN the run emits progress and completes.
3. THEN progress handling introduces no model input.
4. Example: "PROGRESS_ONLY_789" appears in the live view but not in the main model's subsequent context or final tool result; no additional child or parent prompt is sent to obtain activity.

### REQ5: Maestro MUST release progress resources whenever execution ends

Delta: added

1. Release progress subscriptions and periodic refresh resources on completion, startup failure, execution failure, and interruption.
2. Stop publishing progress for an ended run.

Verified by: [AC9](#ac9-ended-runs-release-progress-resources).

#### AC9: Ended runs release progress resources

1. GIVEN a run with progress resources allocated.
2. WHEN execution completes, fails during startup or execution, or is manually interrupted.
3. THEN no progress subscription or periodic refresh remains active for that run.
4. Example: Interrupt a builder at 40 seconds, then allow time to advance and attempt to deliver another child event. The ended run emits no further updates. Apply the same observation after normal completion, a startup error after progress allocation, and a provider failure.

## Regression checks

### AC10: Display truncation does not shorten the saved child conversation

1. GIVEN a child emitting a normal assistant message longer than Pi's collapsed preview.
2. WHEN the run completes after that message is displayed through progress.
3. THEN the native saved child session contains the complete message.
4. Example: The child emits lines "Line 1" through "Line 30". The saved session contains all 30 lines even when the live collapsed view displayed fewer.

## Assumptions

* The example's wording and spacing are illustrative; Pi and the implementation choose the exact presentation.
* Refresh cadence is a routine implementation choice, not a configurable setting.
