# 20261015-154812-route-finding-driven-spec-revisions-through-drafting-spec: Route finding-driven spec revisions through drafting-spec

> After owner approval, this specification is the contract for the builder and verifier.

## 1. Context, goals, and scope

Spec revisions currently follow different paths after builder questions and verifier findings.
Make both paths return to drafting-spec before revision and renewed approval.

The owner and Maestro revise the same spec. The owner reviews it and replies GREEN FLAG. Maestro then records approval and starts another builder run.

Out of scope: changes to the existing escalation route, finding rejection and code-fix outcomes, automatic recovery, or new workflow phases.

## 2. Requirements and constraints

Add revise-spec as a third finding decision in the existing maestro_resolve_findings operation.
Each revision decision includes findingId, decision set to revise-spec, reason, and specChange describing the agreed requirement change.
The reason and specChange must contain nonwhitespace text.

Record the complete current decision batch in the active verifier handoff before saving the next phase.
Save each revision decision, reason, and specChange in that finding's existing decision object.
Only the current handoff's decision fields change. Earlier numbered handoffs remain unchanged.

If any decision is revise-spec, move the same workflow from findings-decision to drafting-spec before editing the spec.
Revision takes priority over fix-code and reject in a mixed batch, while all submitted decisions are saved.
This action does not approve the spec or start an agent.

Revise and review the same spec in drafting-spec. Require renewed GREEN FLAG before a separate approval moves it to ready-for-builder.
Spec approval must be allowed only from drafting-spec. Direct approval from findings-decision is rejected without changing saved files.

Keep the existing outcomes when no spec change is needed: rejecting every finding reaches candidate-ready, while any fix-code decision returns to ready-for-builder.
Preserve existing finding batch validation and numbered handoff history. Existing reports and resolution calls without revise-spec remain valid.
Missing or blank revision fields reject submission before any saved file changes.

Tool responses must distinguish findings requiring spec revision from findings assigned for code fixes or rejected.
For a revision batch, report drafting-spec and direct revision of the same spec and renewed approval before a builder run.
Maestro guidance must describe recording the complete batch before revision. After renewed approval, the revised spec controls subsequent work.
Earlier findings and their decisions remain historical context rather than instructions that override the revised spec.
Human documentation must explain the event flow and owner approval, without internal tool parameters or agent procedures.

## 3. Technical decisions

Define the new findings-decision to drafting-spec transition in src/workflow/transitions.ts and apply it through transitionWorkflow.
Remove findings-decision from the phases accepted for spec approval.

Reuse the existing resolution operation and the finding's decision object. Do not add a tool, a parallel decision store, or a batch-level revision flag.
A separate revise-spec decision records why the requirements must change without mislabeling it as a code fix or rejection.

Relevant boundaries: src/artifacts/verifier-handoff/schema.ts defines saved decisions, src/tools/main/resolve-findings.ts defines tool input and results, and src/workflow/verifier/resolveFindings.ts maps submitted decisions into the saved report.
The mapper and event selection must preserve the new decision rather than treating it as fix-code.

## 4. Acceptance criteria

These criteria cover the new revision route. Existing rejection, fix-code, and invalid-batch scenarios remain requirements without duplicate criteria.

### AC1: A finding-driven revision returns to drafting-spec

1. Coverage: Success.
2. Probe: Start with unresolved verifier findings in findings-decision. Record the owner's choice to revise the spec and inspect the saved workflow and response.
3. Expected result: The same workflow and response identify drafting-spec as the next phase and require revision and renewed approval before another builder run.
4. Example: The workflow is findings-decision and only V1/F1 is unresolved. It reports that exports omit archived rows. Submit findingId F1, decision revise-spec, reason "Exports must show current records only", and specChange "Exclude archived rows from exports". The saved phase and returned phase are drafting-spec. The response identifies F1 as requiring revision and directs revision and renewed approval, not a builder run.

### AC2: Direct approval from findings-decision is rejected

1. Coverage: Failure.
2. Probe: Request spec approval from findings-decision with valid criterion numbering.
3. Expected result: Approval fails because the phase does not permit it. Saved files remain unchanged.
4. Example: The workflow is findings-decision, V1/F1 is unresolved, and the spec contains the valid heading "### AC1: Export current rows". Calling maestro_mark_spec_ready fails. The workflow, spec, and handoffs retain their previous contents.

### AC3: A revised spec receives approval separately from the revision choice

1. Coverage: Success.
2. Probe: Enter drafting-spec through a finding-driven revision, revise the same spec, obtain renewed GREEN FLAG, and request approval separately.
3. Expected result: The same workflow reaches ready-for-builder through that separate approval.
4. Example: From findings-decision, resolve V1/F1 with decision revise-spec, reason "Exports must show current records only", and specChange "Exclude archived rows from exports". In drafting-spec, change that same spec to require exports of current rows only, with continuous criterion numbering. The owner reviews it and replies GREEN FLAG. A separate maestro_mark_spec_ready call returns ready-for-builder for the same specId. The saved V1/F1 revision decision remains unchanged.

### AC4: A mixed batch preserves every decision in its original report

1. Coverage: Success.
2. Probe: Resolve a complete batch containing revise-spec, fix-code, and reject in an active verifier report with an earlier report present. Read the saved reports.
3. Expected result: Only the active report's decision fields change, preserving every submitted decision and revision detail. Earlier reports remain unchanged.
4. Example: V1.json already exists, and V2 contains unresolved F1, F2, and F3. Submit F1 as revise-spec with reason "Exports must show current records only" and specChange "Exclude archived rows from exports". Submit F2 as fix-code and F3 as reject with reason "Outside the approved scope". V2 saves those exact decision objects. Its other content and V1.json remain unchanged.

### AC5: Revision takes priority in a mixed batch

1. Coverage: Success.
2. Probe: Submit a complete batch containing revision, code-fix, and rejection decisions and inspect the saved phase and response.
3. Expected result: The saved phase and response are drafting-spec, regardless of decision order, rather than ready-for-builder or candidate-ready.
4. Example: In findings-decision, submit F1 as fix-code, F2 as reject with reason "Outside the approved scope", and F3 as revise-spec with reason "Exports must show current records only" and specChange "Exclude archived rows from exports". The saved and returned phases are drafting-spec. Repeating the scenario with F3 first produces the same phase.

### AC6: Incomplete revision details are rejected without saving

1. Coverage: Failure.
2. Probe: Submit an otherwise complete valid batch with a revise-spec decision whose reason or specChange is missing or contains only whitespace.
3. Expected result: Submission is rejected before any saved file changes.
4. Example: In findings-decision with only V1/F1 unresolved, submit revise-spec with reason "Exports must show current records only" but no specChange. The submission fails and the workflow, spec, and handoffs remain unchanged. Repeat with specChange set to a space, then with valid specChange "Exclude archived rows from exports" and reason omitted or set to a space. Each submission fails without saved changes.

### AC7: Written guidance describes one revision flow

1. Coverage: Success.
2. Probe: Read affected tool descriptions, Maestro guidance, and human workflow documentation for both origins of spec revision.
3. Expected result: Both origins return to drafting-spec before revision and require renewed approval before another builder run. No affected guidance permits revision and direct approval in findings-decision.
4. Example: An archived-row question from B1/E1 and an archived-row finding from V1/F1 each lead to drafting-spec when the owner chooses revision. The written flow then requires review, renewed GREEN FLAG, and approval before ready-for-builder. Human documentation describes these events without tool arguments.
