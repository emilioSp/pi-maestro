---
type: ADR
id: 'ADR-010'
title: 'Use the Pi SDK for sequential agent delegation'
status: active
---

## Context

Main-extension pre-load exclusion is superseded by [ADR-012](0012-filter-main-maestro-registrations-after-native-discovery.md).

`Maestro` currently depends on `pi-subagents` to execute the `builder`, `verifier`, and `simplifier`. Its delegation needs are limited: only one workflow and one child
agent execute at a time, and `Maestro` waits for each child to finish. `Maestro` already owns workflow transitions, role instructions, saved `handoffs`, and result
validation.

The `owner` wants to remove the `pi-subagents` dependency without building a general-purpose delegation framework. Pi provides `createAgentSession()` for direct SDK
integration and `RpcClient` for subprocess control. Separate conversations do not require separate processes.

## Decision

1. Replace `pi-subagents` delegation with direct use of the Pi SDK through `createAgentSession()`, rather than RPC subprocesses.
2. Preserve sequential execution: one workflow at a time, one child agent at a time, with `Maestro` waiting for completion.
3. Use task-and-handoff communication, not a live supervisor dialogue. `Maestro` assigns the task; the child works, saves its `handoff`, and finishes.
4. When an `owner` decision is needed, the `builder` saves an `escalation` and ends its `run`. `Maestro` discusses it with the `owner` and records the decisions through
   the existing workflow. Any subsequent `builder` `run` starts a fresh conversation and reads the saved decisions.
5. Child sessions must have access to the same working tools available to `Maestro`, plus the tools needed to save their own `handoffs`. Do not load the main `Maestro`
   extension into child sessions. Tools supplied by other extensions may remain available even if they support delegation; role instructions forbid using them to
   delegate. This is a tool-access requirement, not merely an extension-loading policy.
6. Automatically load enabled global and project extensions, excluding the main `Maestro` extension. Provide the corresponding working-tool environment through Pi's
   native APIs and configuration, including separate Pi support such as MCP and `codemode` where needed. Loading the same extensions alone does not reproduce every CLI
   capability. Compatibility of arbitrary extensions, tools, and model providers is outside Maestro's responsibility; do not add custom compatibility checks or adapters.
7. All three child roles receive the owner's global instruction file, normally `~/.pi/agent/AGENTS.md`, preserving the current `inheritGlobalContext: true` behavior.
   These instructions are not the parent's conversation history.
8. All three child roles automatically receive project instructions discovered by Pi, such as applicable `AGENTS.md` files, preserving the current
   `inheritProjectContext: true` behavior. These instructions supplement global instructions and role-specific guidance.
9. All three child roles can discover and use available skills, preserving the current `inheritSkills: true` behavior. Expose the skill catalog without loading every
   skill's full contents into the conversation. Skills remain subject to the child's role boundaries and permitted tools; they do not authorize delegation or workflow
   management.
10. During a child `run`, report the role, elapsed time, current tool, and recent normal assistant text through Pi's standard tool-progress updates (`onUpdate`). Use Pi's
    built-in presentation, including its default layout, truncation, and expansion behavior. Do not build a custom renderer or implement a fixed visible-line count or
    terminal-height adaptation. Update progress in place instead of appending intermediate messages to the main conversation. Do not include internal reasoning or full
    command output. Continue reporting activity when the child produces no text; do not prompt it to generate artificial progress messages.
11. Intermediate activity text is UI-only and must not enter the main model's context. `Maestro` continues to receive the existing workflow result. Pi's display limits do
    not truncate the saved child conversation. The five-, ten-, and twenty-line alternatives are superseded by the decision to use Pi's standard presentation.
12. Persist child conversations using Pi's native session format, rather than a custom transcript format. Saved sessions remain available after execution for diagnosis,
    including unsuccessful executions. Each child `run` starts a new conversation; persistence does not introduce automatic session reuse or workflow recovery.
13. At child completion or failure, show the `owner` the path to its saved Pi session file, when one exists. The `owner` can inspect the file directly or use Pi's native
    HTML export with `pi --export <session-file> conversation.html`. Do not build a transcript inspector inside `Maestro`. Reading or exporting a transcript does not
    resume child execution.
14. Do not impose an automatic child `run` timeout in `Maestro`. Remove `builder.timeoutMinutes`, `verifier.timeoutMinutes`, and `simplifier.timeoutMinutes` from
    `.pi/maestro.json` configuration support, including schema validation, defaults, launch inputs, and configuration documentation. A child continues until it finishes,
    fails, or is manually interrupted. This removes the workflow-level deadline, not the elapsed-time progress display or timeouts internal to Pi and its tools.
15. Remove `timeoutMinutes` from the configuration schemas and retain `additionalProperties: false`. Existing TypeBox-based validation rejects configuration files that
    still contain the field. Do not add a migration, ignored legacy fields, or special compatibility handling. The `owner` removes obsolete fields manually.
16. Preserve the existing execution-error policy. Launch failures, failed child executions, and missing or invalid `handoffs` stop the workflow and report the error.
    `Maestro` does not automatically start another child session to retry, repair saved state, or roll back files. Preserve the remaining project files and saved workflow
    state for manual `owner` follow-up, including partial protocol writes. Errors do not introduce recovery transitions or synthetic `escalations`.
17. Propagate manual cancellation of the main tool to its active child through `session.abort()` and await the interruption before releasing the child session. Do not
    send a final model prompt asking the child to finish, and do not generate a synthetic `handoff`. Leave project files and saved workflow state unchanged by cleanup.
    Close child sessions and release progress subscriptions and session resources on completion, failure, or cancellation. Do not start another child while the previous
    child remains active.
18. Store child sessions in a `subagents/` subdirectory of Pi's normal project session directory, normally `~/.pi/agent/sessions/--<project-path>--/subagents/`. Resolve
    the parent directory through Pi's session-directory API rather than reimplementing project-path encoding. Use Pi's native `SessionManager` with this directory. Do not
    create a `subagents/` directory inside the project repository.
19. Require Pi 1.5.0 or later for the SDK-based implementation. Update the declared Pi requirement and align implementation verification with this baseline. Do not add
    compatibility fallbacks for earlier Pi versions. This minimum is a scope choice, not a claim that all earlier versions lack the required APIs.
20. Do not build an additional tool allowlist or exclusion list to prevent child delegation. Children may have delegation tools available, but their role instructions
    forbid using them. This deliberately relies on instruction compliance rather than technical removal of delegation capabilities. The main `Maestro` extension remains
    excluded.
21. Leave compatibility of external integrations to Pi and the `owner`. Do not add a preflight that compares parent and child tool availability, extension health checks,
    special adapters, or a fallback system for incompatible integrations. This scope boundary does not suppress errors actually reported during launch or execution; those
    follow the existing stop-and-report policy.

## Consequences

The replacement does not need supervisor request routing or a mechanism that makes the main model answer a child while waiting for it. Saved `handoffs` remain the
communication boundary for completed work and `escalations`.

SDK sessions share a Node.js process. Separate conversation histories do not isolate module-level mutable state or project files. Child resource loading must account for
this distinction.

Automatic extension loading intentionally differs from the current foreground behavior of `pi-subagents` 0.78.0, which does not automatically load the parent's global and
project extensions. Shared working-tool access is provided through Pi's native environment, not an independent compatibility guarantee for every integration. The
replacement must use Pi's tool activation and support such as MCP and `codemode`, rather than assuming the SDK supplies the CLI's capabilities by default. There is no
custom parity check, health gate, or adapter layer for third-party integrations. Children do not inherit the parent's conversation, but they share the process and may
interact with process-wide mutable state. Loaded extensions can create additional connections, timers, and process-wide effects. Excluding the main `Maestro` extension
does not establish compatibility with every other extension or remove delegation tools supplied by other extensions. `Maestro` launches its own children sequentially;
compliance with the broader no-delegation rule relies on child instructions. A child that ignores those instructions could launch other agents. This accepted limitation
avoids maintaining tool classifications and exclusion lists and does not claim a sandbox; even ordinary shell access can launch processes.

Pi's standard tool-progress presentation replaces FleetView's live activity display, not its full transcript inspector. `Maestro` owns the progress data, not a new
rendering system or a guaranteed panel size. Displaying text already produced by the child requires no additional model generation and does not add that text to the main
model's context. Full transcript inspection uses saved session files and Pi's existing export capability rather than a replacement inspector. The main tool must connect
cancellation to the child SDK session and perform session cleanup; selecting the SDK alone does not wire these operations together.

Native session files retain child messages, tool calls, and tool results beyond the lifetime of the child session. They may contain project data present in those messages
and results. Persistence is separate from the live progress display and does not add the transcript to the main model's context. The dedicated `subagents/` subdirectory
keeps child session files separate from the main session files without adding transcript files to the project repository or introducing a custom storage format.

Removing the configured deadline simplifies child execution but permits indefinitely running work until manual interruption. This is a breaking configuration change:
files that still contain `timeoutMinutes` fail existing configuration validation until the `owner` removes the obsolete fields. Document the removal without adding legacy
compatibility code.

Manual cancellation uses Pi's in-process cancellation lifecycle, not termination of a separate operating-system process. It does not undo completed writes or introduce a
final model turn. `Maestro` uses Pi's cancellation and cleanup lifecycle; behavior of third-party integrations remains outside its compatibility contract.

The Pi minimum increases from the currently documented 1.0.0 to 1.5.0. Earlier hosts are outside the new compatibility contract. At decision time, the project has Pi
1.0.3 installed locally and the active harness uses Pi 1.5.0; the implementation must be verified against the selected baseline rather than treating the older local
installation as sufficient verification. This ADR changes no installed dependencies.
