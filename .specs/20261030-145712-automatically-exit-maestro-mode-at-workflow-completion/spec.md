# Automatically exit Maestro mode at workflow completion

See [proposal.md](proposal.md) for motivation and scope. Roadmap: [MAESTRO-26](https://linear.app/emilio-spatola/issue/MAESTRO-26).

## Requirements

### REQ1: Automatically deactivate after the final summary

Delta: modified

Before: Reaching `candidate-ready` leaves `Maestro` active until the `owner` disables it manually.

For the active workflow, `Maestro` remains active after successful completion reaches `candidate-ready` and while delivering the final summary. It automatically deactivates after that response finishes, before the next interaction, without another `/maestro` command. This applies both when the `simplifier` completes and when it is skipped because Git is unavailable.

Intermediate phases, failed or interrupted execution, and an interrupted or failed final response do not trigger automatic deactivation. Saved workflow state alone is not evidence that the final summary was delivered.

Verified by: [AC1](#ac1-completed-simplification-exits-after-the-summary), [AC2](#ac2-skipped-simplification-exits-after-the-summary), [AC3](#ac3-maestro-stays-active-until-the-final-response-finishes), [AC4](#ac4-an-interrupted-final-response-does-not-deactivate-maestro).

#### AC1: Completed simplification exits after the summary

1. Probe: With `Maestro` active on a workflow in `simplifier-running`, complete simplification successfully and deliver the final summary.
2. Expected result: `Maestro` is inactive after the final response finishes, without an additional `/maestro` command.
3. Example: The `simplifier` saves `S.json` with summary "No simplification needed" and the workflow reaches `candidate-ready`; after the final summary is delivered, Pi automatically leaves `Maestro` mode.

#### AC2: Skipped simplification exits after the summary

1. Probe: With `Maestro` active on a workflow in `simplifier-running`, request simplification where Git readiness cannot be confirmed and deliver the final summary.
2. Expected result: `Maestro` is inactive after the final response finishes, without an additional `/maestro` command.
3. Example: The Git check returns `false` and the workflow reaches `candidate-ready`; after a final summary reporting skipped simplification, Pi automatically leaves `Maestro` mode.

#### AC3: Maestro stays active until the final response finishes

1. Probe: Complete an active workflow, observe mode state after the terminal tool result, and observe it while the final response is being delivered.
2. Expected result: `Maestro` remains active until delivery of the final response finishes.
3. Example: After `maestro_run_simplifier` returns `candidate-ready`, `Maestro` stays active while the final response reports verification results and the saved simplifier summary "Simplified counting"; it does not deactivate at the tool result.

#### AC4: An interrupted final response does not deactivate Maestro

1. Probe: After an active workflow successfully reaches `candidate-ready`, interrupt the final response before delivery completes or let that response fail.
2. Expected result: `Maestro` does not automatically deactivate.
3. Example: The workflow is saved at `candidate-ready`, but the summary request fails or the response is cancelled halfway through; `Maestro` remains active despite the completed saved phase.

### REQ2: Restore normal Pi interaction

Delta: modified

Automatic deactivation clears the active `spec` selection, removes `Maestro` tools from the active tool set, and clears the `Maestro` status. Subsequent interaction has no active `Maestro` prompt section. Other active tools and prompt sections are preserved.

Verified by: [AC5](#ac5-normal-pi-interaction-is-restored).

#### AC5: Normal Pi interaction is restored

1. Probe: Complete an active workflow with `read` and a foreign extension tool active alongside the `Maestro` tools, deliver the final summary, then start another prompt containing a foreign prompt section.
2. Expected result: The active `spec` is cleared, the `Maestro` tools and status are absent, and the next prompt has no `Maestro` section; unrelated tools and the foreign section remain.
3. Example: After the final summary, `read` and `foreign_tool` stay active, the active `spec` is null, the `maestro` status is unset, and a new prompt retains `foreign: "Keep foreign instructions"` but has no `maestro` section.