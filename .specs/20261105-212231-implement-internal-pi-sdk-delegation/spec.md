# 20261105-212231-implement-internal-pi-sdk-delegation: Implement internal Pi SDK delegation

See [proposal.md](proposal.md) for scope and [design.md](design.md) for approved technical decisions.

## Verification scope

Verify the standalone executor manually, independently of workflow migration. Automated integration tests are deferred to the following migration tasks; useful unit tests
remain in scope. Existing project checks remain applicable.

## Requirements

### REQ1: Execute caller-supplied tasks in fresh SDK conversations

Delta: added

Provide one internal execution operation under `src/delegation/`. The caller supplies the task, role guidance, working directory, available model and thinking level,
additional tools, and an optional cancellation signal. Execute the task through Pi's SDK with those inputs, without requiring a Maestro role, spec ID, or workflow.
Each invocation starts a new conversation without the parent's or a previous child's conversation history. Use Pi's native model capabilities and thinking-level handling.

Verified by: [AC1](#ac1-a-role-independent-task-uses-the-supplied-execution-settings), [AC2](#ac2-later-executions-start-without-earlier-conversation-history)

#### AC1: A role-independent task uses the supplied execution settings

1. Probe: Invoke the executor without a workflow, supplying an available model, supported thinking level, role guidance, and a directory containing a readable file.
   Inspect the child session and its completed task.
2. Expected result: The task executes in a child configured with the supplied settings, independently of the three workflow roles.
3. Example: With `openai-codex/gpt-5.6-luna` available and supporting `max`, supply that model and thinking level, guidance to answer in Italian, and a directory containing
   `message.txt` with `ciao`. Ask for that file's content. The child uses that model and thinking level, reads the file from the supplied directory, and answers `ciao`.

#### AC2: Later executions start without earlier conversation history

1. Probe: Supply a conversation-only marker in one task, finish that execution, and start a second task without that marker. Inspect the second child's initial context.
2. Expected result: The second conversation contains neither the first task nor the parent's conversation messages.
3. Example: The parent conversation contains `PARENT_ONLY_42`, and the first child task contains `CHILD_ONLY_17`; neither value is saved as an instruction or supplied to
   the second task. The second child's initial conversation contains neither marker and has a different session identity from the first child.

### REQ2: Load native instructions and skills

Delta: added

Use Pi's native discovery to supply global and applicable project instructions alongside the caller's role guidance. Expose the available skill catalog without loading
all skill bodies into the initial context. The child can read a relevant skill through its working tools. Do not copy the main conversation as a substitute for resources.

Verified by: [AC3](#ac3-the-child-receives-discovered-instructions), [AC4](#ac4-skill-bodies-are-loaded-only-when-requested)

#### AC3: The child receives discovered instructions

1. Probe: Execute a task with distinct global instructions, project instructions, and supplied role guidance. Inspect the child's effective initial instructions.
2. Expected result: All three instruction sources are present in the child.
3. Example: Global instructions contain `GLOBAL_CHECK_1`, applicable project instructions contain `PROJECT_CHECK_2`, and role guidance contains `ROLE_CHECK_3`. All three
   markers appear in the child's effective initial instructions.

#### AC4: Skill bodies are loaded only when requested

1. Probe: Make a skill discoverable, inspect the initial skill context, and ask the child to read that skill.
2. Expected result: The skill is discoverable initially, but its full instructions enter the conversation only when read.
3. Example: Skill `sdk-proof` has description `Check a sample file` and body marker `SKILL_BODY_8`. Initially the catalog lists the skill and its path without the body
   marker. Reading the skill supplies `SKILL_BODY_8` to the child.

### REQ3: Supply the native working-tool environment without loading Maestro

Delta: added

Load enabled global and project extensions and Pi's native tool support, excluding the main Maestro extension before its code is loaded for the child. Supply the main
session's corresponding working-tool environment through native discovery and configuration, including MCP, codemode, and tool search when enabled, plus caller-supplied
tools. Keep tool activation under Pi's native rules. Do not add parity preflights, compatibility adapters, or delegation-prevention filters. Caller-supplied role guidance
remains responsible for forbidding further delegation. Child creation and shutdown must not deactivate the parent's Maestro mode or replace its selected spec.

Verified by: [AC5](#ac5-the-child-can-execute-native-and-caller-supplied-tools), [AC6](#ac6-enabled-extension-and-native-support-tools-are-usable),
[AC7](#ac7-child-lifecycle-preserves-the-parent-maestro-state)

#### AC5: The child can execute native and caller-supplied tools

1. Probe: Execute a task that reads a file through the native read tool and uses an additional tool supplied only for this invocation.
2. Expected result: Both tool calls execute in the child's tool environment.
3. Example: `value.txt` contains `7`; caller-supplied tool `double_value` returns twice its numeric input. The child reads the file, calls `double_value` with `7`, and
   receives `14`, without loading any Maestro handoff tool.

#### AC6: Enabled extension and native support tools are usable

1. Probe: Supply enabled global and project extensions with observable tools, enable native codemode and tool search, and configure an accessible MCP tool exposed through
   native discovery. Ask the child to use each configured capability.
2. Expected result: The configured extension and native capabilities execute through Pi's normal tool mechanisms.
3. Example: Global extension tool `global_echo` returns `global`; project extension tool `project_echo` returns `project`; an MCP echo tool returns `mcp-ok`. The child
   calls the two extension tools, discovers the MCP echo through tool search, and calls it through codemode, receiving those three values.

#### AC7: Child lifecycle preserves the parent Maestro state

1. Probe: With Maestro active and a spec selected in the parent, inspect which extensions load for a child; complete and close that child, then inspect the parent state.
2. Expected result: The main Maestro extension is not loaded for the child, and the parent's active mode and selected spec remain unchanged.
3. Example: The parent is active on `20261105-120000-sample-change`. After one independent SDK task and cleanup, it is still active on that spec, and the child's loaded
   extensions contain no main Maestro extension.

### REQ4: Wait for completion without an executor deadline or workflow orchestration

Delta: added

The operation waits for the child to finish, fail, or complete interruption and cleanup before settling. Callers invoke it sequentially and await each invocation; do not
add queues, locks, or concurrent-request management. Impose no automatic execution deadline and start no replacement child to retry or repair work. Pi's own recovery
and tool-level timeouts remain Pi's responsibility. The executor does not inspect role outcomes, validate handoffs, or select workflow phases.

Verified by: [AC8](#ac8-the-caller-remains-pending-until-the-child-finishes), [AC9](#ac9-execution-failures-reach-the-caller-without-replacement-runs)

#### AC8: The caller remains pending until the child finishes

1. Probe: Run a task whose cooperative tool remains pending until manually released, then await a second invocation. Inspect the execution path for an executor deadline.
2. Expected result: The first invocation remains pending until completion, and the awaited second child starts only after the first has finished and been cleaned up,
   without an executor-imposed deadline.
3. Example: Child A waits in a cooperative tool until manually released. The caller has not reached its next awaited execution during that wait. After release and A's
   cleanup, child B starts with a fresh session. No executor timer bounds A's execution.

#### AC9: Execution failures reach the caller without replacement runs

1. Probe: Exercise a launch failure and a terminal model-execution failure after any native Pi recovery. Observe the error returned to the caller and child creation.
2. Expected result: Each failure reaches the caller with its diagnostic cause; the executor starts no replacement execution or workflow recovery.
3. Example: Launching with unavailable model `missing-provider/missing-model` reports model unavailability rather than selecting a different model. In a separate execution,
   a terminal provider error `manual-proof-failure` reaches the caller with that diagnostic and no second child is created.

### REQ5: Forward cancellation and complete native cleanup

Delta: added

Forward cancellation of an active invocation to `session.abort()` and await interruption before releasing the child. If cancellation is already requested before task
submission, do not submit the task. On success, failure, and cancellation, complete native extension shutdown and release owned sessions, subscriptions, and cancellation
listeners. Do not shut down the parent's resources, request a final model response, undo file writes, or generate synthetic handoffs. Cancellation remains cooperative;
forced termination of an individual SDK child is not provided.

Verified by: [AC10](#ac10-active-cancellation-waits-for-the-child-to-stop), [AC11](#ac11-a-cancelled-invocation-does-not-submit-a-new-task),
[AC12](#ac12-all-exit-paths-release-owned-resources)

#### AC10: Active cancellation waits for the child to stop

1. Probe: Cancel an invocation while its child is using a cooperative, abort-aware tool, and observe interruption and the invocation's completion.
2. Expected result: Cancellation reaches the child's abort lifecycle, and the invocation reports interruption only after the child has stopped.
3. Example: A child writes `partial.txt` and enters an abort-aware wait. Cancelling the caller reaches `session.abort()`, interrupts that wait, and returns interruption
   after the child becomes idle. `partial.txt` remains; no final prompt, rollback, or synthetic handoff is produced.

#### AC11: A cancelled invocation does not submit a new task

1. Probe: Invoke with an already-cancelled signal; separately cancel while preparation is pending, before task submission.
2. Expected result: Neither invocation submits its task to the model.
3. Example: A task would create `should-not-exist.txt`. With the signal cancelled before submission, no model task starts and that file is not created; any preparation
   resources are cleaned up.

#### AC12: All exit paths release owned resources

1. Probe: Exercise successful completion, preparation failure after resources have been acquired, execution failure, and manual cancellation. Observe owned resource
   shutdown and cancellation/event subscriptions on each path.
2. Expected result: Every acquired child resource is released through the appropriate native lifecycle before its invocation settles.
3. Example: An enabled child extension opens a connection on `session_start` and closes it on `session_shutdown`. After each exit path where it started, that connection
   is closed and the executor's cancellation/event listeners are removed, while a connection owned by the parent remains open.

### REQ6: Persist fresh native sessions and expose their paths

Delta: added

Persist each child conversation in Pi's native session format beneath `subagents/` in Pi's project session directory, resolved through Pi's API. Expose the saved file
path to the caller on completion, failure, or cancellation when a file exists; do not claim a saved file if none exists. Do not store transcripts in the project or resume
a prior conversation. Preserve available conversation records from unsuccessful executions.

Verified by: [AC13](#ac13-completed-conversations-have-native-session-files), [AC14](#ac14-unsuccessful-executions-retain-available-session-paths),
[AC2](#ac2-later-executions-start-without-earlier-conversation-history)

#### AC13: Completed conversations have native session files

1. Probe: Complete a task and inspect the returned saved path and its file using Pi's native session reader or export.
2. Expected result: The returned path identifies a readable native Pi session beneath the API-resolved project session directory's `subagents/` directory.
3. Example: For a task reading `value.txt`, the returned file is under Pi's project session directory in `subagents/`; Pi can read its user task, assistant messages, and
   read-tool result. No transcript directory is created in the project repository.

#### AC14: Unsuccessful executions retain available session paths

1. Probe: Fail and cancel separate executions after conversation data has been persisted; also fail an invocation before a session file exists. Inspect the error metadata.
2. Expected result: A diagnostic exposes the existing saved session path when available and does not invent a path for an unsaved conversation.
3. Example: A provider failure after task persistence includes a readable path containing that task. Cancellation after a tool call includes the saved conversation path.
   A failure before conversation creation reports no saved file.

### REQ7: Document the standalone capability without claiming role migration

Delta: modified

Before: Execution documentation describes the pi-subagents workflow; no standalone SDK executor is available.

Document the internal executor's location, supplied inputs, native session storage, and cooperative cancellation in the relevant existing documentation. Update README.md
where its contents are affected. Keep it clear that all three workflow role tools still use pi-subagents and require the existing integration. Link this specification
from MAESTRO-FREE-PRE-3 in ROADMAP.md and record manual evidence without claiming owner acceptance or completion. Do not introduce a public invocation command or a
transcript inspector as documentation support.

Verified by: [AC15](#ac15-documentation-distinguishes-internal-sdk-execution-from-the-current-workflow)

#### AC15: Documentation distinguishes internal SDK execution from the current workflow

1. Probe: Compare the updated human documentation and roadmap entry with the delivered executor and unchanged workflow delegation tools.
2. Expected result: Documentation accurately identifies the standalone SDK capability without describing the existing role execution as migrated or the item as accepted.
3. Example: Documentation points to `src/delegation/` for the internal executor and explains cancellation and saved sessions; role execution and prerequisites still name
   pi-subagents. MAESTRO-FREE-PRE-3 links this specification and its manual evidence without recording final owner acceptance.
