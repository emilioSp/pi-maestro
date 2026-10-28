# 20261016-090319-add-a-dedicated-simplifier-after-verification: Add a dedicated simplifier after verification

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions

Check Git readiness with one command in the project directory: `git rev-parse --is-inside-work-tree`. A successful result of `true` enables simplification. If the command is unavailable, fails, or does not return `true`, skip simplification. Do not add separate Git installation, version, or `.git` directory checks. This readiness check runs only in `maestro_run_simplifier`, after validating the saved state and before delegation.

Use the existing agent execution and tool pattern. Add `maestro_run_simplifier` in the main session and `maestro_record_simplifier_handoff` in child sessions. The former accepts only `specId`. The latter accepts `specId`, `refactoredFiles`, `summary`, and `notes`, with the tool supplying the artifact version.

The two entry routes save `simplifier-running` before Maestro invokes the new foreground run tool. The run tool reads the saved state, checks identity and phase, refreshes status, and delegates. Do not add a separate ready phase. Leave the preparation helper structure to the builder, following the existing execution pattern. Adapt verifier result validation and finding-resolution results to recognize this new outcome.

The structural design adds an agent definition, role-specific workflow and artifact modules under the existing layout, the two tools, and corresponding tests and fixtures. Do not add a shared schemas directory or redesign other roles. Preserve the fixed-destination event table in `src/workflow/transitions.ts`. Apply transitions through `transitionWorkflow`. Keep Git execution outside the transition module. Do not introduce conditional transition callbacks or a general transition framework.

Reuse `src/tools/utils/pi-subagent-delegation.ts` for delegation error handling rather than adding simplifier-specific timeout handling. Acceptance criteria do not require separate tests: shared scenarios can assert warning and phase, and configuration coverage can extend existing tests.

Relevant integration points are `src/workflow/verifier/completeVerifierPass.ts`, `src/workflow/verifier/resolveFindings.ts`, `src/tools/main/run-verifier.ts`, the two extensions, configuration, path handling, agent-role mapping, and Maestro instructions and status.

Agent quality rules are verified by inspecting the shipped instructions. Scripted delegation can check the workflow without claiming that a real model performed or independently verified a refactoring.
