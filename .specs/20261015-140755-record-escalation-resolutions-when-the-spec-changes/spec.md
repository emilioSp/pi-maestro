# 20261015-140755-record-escalation-resolutions-when-the-spec-changes: Record escalation resolutions when the spec changes

> After owner approval, this specification is the contract for the builder and verifier.

## 1. Context, goals, and scope

R-17 requires a saved answer for every current builder escalation, including answers that require a spec revision.
Currently, the revision route bypasses resolution recording and permits direct approval from escalation-decision.

Save all answers in their original builder handoff before leaving escalation-decision. Reuse the same spec for revision and renewed approval.

Out of scope: changes to verifier finding decisions, automatic recovery, parallel decision storage, new tools, new workflow phases, and the general R-18/R-19 guidance changes.
Coverage labels and exclusion of scenarios already covered by tests apply to this spec only.

## 2. Requirements and constraints

### Resolution recording

Use maestro_resolve_escalations for the complete current decision batch, whether or not the spec must change.
Each decision retains escalationId, selectedOptionId, decision, and reason.
Save the chosen solution and the owner's reason in the corresponding question's existing resolution fields.
For each answer that requires revision, identify the question through escalationId and describe the agreed spec change in decision.
Do not add fields to saved resolutions or another decision store.

Save all validated resolutions in the active builder handoff before saving the next workflow phase.
Only its resolution fields change. Earlier numbered handoffs remain unchanged.
Preserve existing validation for complete batches, IDs, options, nonblank answers and reasons, incompatible handoffs, phases, and already resolved questions.
Invalid submissions leave saved files unchanged.

### Routing and approval

| Owner decision batch | Saved next phase | Next action |
|---|---|---|
| No answer requires a spec change | ready-for-builder | Run the builder separately without renewed approval. |
| At least one answer requires a spec change | drafting-spec | Revise and review the same spec with the owner. |
| The revised spec receives renewed GREEN FLAG | ready-for-builder | Approve through a separate maestro_mark_spec_ready call, then run the builder. |

Recording answers neither approves a revised spec nor launches an agent.
It never moves directly to ready-for-verifier. That phase still requires a completed builder pass.
Reject maestro_mark_spec_ready from escalation-decision without changing saved files.
Preserve initial approval from drafting-spec and existing finding decisions and revision approval from findings-decision.

Tool text and structured results must report the saved next phase and its corresponding next action.
Maestro guidance and human documentation must describe both routes, including recording revision answers before revising the spec.
After revision, the approved spec controls subsequent work. Earlier questions and answers remain historical context.

## 3. Technical decisions

Reuse the existing resolution operation and handoff schema. The resolution's existing decision text can describe an agreed spec change.
Define both resolution routes explicitly in src/workflow/transitions.ts and apply each through transitionWorkflow.
Do not assign the next phase directly in the resolution operation.
Remove escalation-decision from the phases allowed for spec approval, without removing findings-decision.

Relevant boundaries: src/tools/main/resolve-escalations.ts exposes the tool input and result, src/workflow/builder/resolveEscalations.ts saves answers, and src/artifacts/builder-handoff/schema.ts defines the saved fields.

### Tool input

Add required batch-level boolean specChangeRequired to maestro_resolve_escalations alongside specId and decisions.
Use true when any answer requires a spec revision and false when none does.
Do not infer this value from decision text or default an omitted value.
Reject missing or nonboolean values before writing saved files.
This flag selects the route but is not added to saved handoffs or workflow state.

The explicit flag avoids interpreting free text. Agreed changes remain in each answer's existing decision field.

## 4. Acceptance criteria

Coverage labels describe success, failure, or keeping current behavior unchanged.

### AC1: Revision answers remain in the original handoff

1. Coverage: Success.
2. Probe: Resolve all questions in an active handoff with a mixed batch. One answer requires revision and another keeps the existing requirements. Inspect saved handoffs.
3. Expected result: The active handoff contains exactly the submitted resolutions and otherwise retains its original content. Earlier handoffs remain unchanged.
4. Example: B1.json already exists. B2/E1 asks about archived rows. B2/E2 asks about file encoding and offers option "utf8". Both answers are null. Submit the complete batch with specChangeRequired true. E1 has selectedOptionId null, decision "Revise the spec to include archived rows", reason "Audit exports need complete history". E2 has selectedOptionId "utf8", decision "Use UTF-8", reason "Keep the existing encoding requirement". B2.json stores those exact three resolution values for each question. Its other content and B1.json are unchanged.

### AC2: A revision batch reports drafting-spec as the next state

1. Coverage: Success.
2. Probe: Submit a complete batch that requires revision and inspect the saved workflow and tool response before any approval.
3. Expected result: Saved phase, structured result, and response text identify drafting-spec. The response directs revision and renewed approval rather than a builder or verifier run.
4. Example: The workflow is escalation-decision and B1/E1 has no answer. Submit the answer "Revise the spec to include archived rows", reason "Audit exports need complete history", selectedOptionId null, with specChangeRequired true. The saved phase and returned phase are drafting-spec. The response instructs revision of the same spec and renewed GREEN FLAG before approval and a builder run.

### AC3: Recorded revision answers permit separate renewed approval

1. Coverage: Success.
2. Probe: Record a revision batch, revise the same spec, obtain renewed GREEN FLAG, and request approval separately.
3. Expected result: The same workflow reaches ready-for-builder through the separate approval, with the recorded resolutions still saved.
4. Example: From escalation-decision, resolve B1/E1 with specChangeRequired true, selectedOptionId null, decision "Revise the spec to include archived rows", and reason "Audit exports need complete history". The workflow reaches drafting-spec. Update the same spec to require archived rows with continuous criterion numbering. After renewed GREEN FLAG, maestro_mark_spec_ready returns ready-for-builder for that specId. B1/E1 still contains the submitted answer and reason.

### AC4: Both resolution routes use the central transition definitions

1. Coverage: Success.
2. Probe: Inspect the central transition definitions and trace the resolution operation for both decisions about revision.
3. Expected result: Both routes are defined in src/workflow/transitions.ts and selected through transitionWorkflow, not through direct next-phase assignment elsewhere.
4. Example: Start in escalation-decision with one unresolved question. A complete batch with specChangeRequired false uses a centrally defined transition to ready-for-builder. In a separate instance of that starting state, a complete batch with specChangeRequired true uses a centrally defined transition to drafting-spec. The resolution operation obtains each next state by calling transitionWorkflow.

### AC5: Guidance describes the recorded revision route

1. Coverage: Success.
2. Probe: Read affected tool descriptions, agent guidance, and human workflow documentation for a revision decision.
3. Expected result: They consistently describe recording the complete decision batch before entering drafting-spec, revising the same spec, and obtaining renewed approval separately.
4. Example: Start in escalation-decision with unresolved B1/E1. For the owner's decision to add archived rows, the written route submits the complete batch with specChangeRequired true and records its answer in B1.json before revision in drafting-spec. It then requires renewed GREEN FLAG and a separate approval before another builder run. No affected guidance directs approval straight from escalation-decision or skipping the saved answer.

### AC6: The routing flag must be an explicit boolean

1. Coverage: Failure.
2. Probe: Submit an otherwise valid complete resolution batch with specChangeRequired omitted or set to a nonboolean value.
3. Expected result: The tool rejects each submission without changing saved files.
4. Example: Start in escalation-decision with only B1/E1 unresolved. Submit its valid answer with selectedOptionId null, decision "Use a local compiler", and reason "The required compiler is unavailable", but omit specChangeRequired. The tool rejects the call. Repeat with specChangeRequired set to the string "true". The tool rejects that call too. The workflow, spec.md, and handoffs remain unchanged after both calls.
