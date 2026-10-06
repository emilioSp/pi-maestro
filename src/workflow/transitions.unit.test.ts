import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowEvent,
  type WorkflowPhase,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

const state = (phase: WorkflowPhase, revision = 1): WorkflowState => ({
  version: WORKFLOW_STATE_VERSION,
  specId: '20260321-143052-add-weather-alerts',
  revision,
  phase,
});

describe('workflow transitions', () => {
  it.each([
    {
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      event: WORKFLOW_EVENTS.MARK_SPEC_READY,
      expectedPhase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    },
    {
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
      event: WORKFLOW_EVENTS.MARK_SPEC_READY,
      expectedPhase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    },
    {
      phase: WORKFLOW_PHASES.FINDINGS_DECISION,
      event: WORKFLOW_EVENTS.MARK_SPEC_READY,
      expectedPhase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    },
    {
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      event: WORKFLOW_EVENTS.RUN_BUILDER,
      expectedPhase: WORKFLOW_PHASES.BUILDER_RUNNING,
    },
    {
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
      event: WORKFLOW_EVENTS.OPEN_ESCALATION,
      expectedPhase: WORKFLOW_PHASES.ESCALATION_DECISION,
    },
    {
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
      event: WORKFLOW_EVENTS.RESOLVE_ESCALATION,
      expectedPhase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    },
    {
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
      event: WORKFLOW_EVENTS.BUILDER_FAILED,
      expectedPhase: WORKFLOW_PHASES.BUILDER_FAILED,
    },
    {
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
      event: WORKFLOW_EVENTS.BUILDER_DONE,
      expectedPhase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    },
    {
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
      event: WORKFLOW_EVENTS.RUN_VERIFIER,
      expectedPhase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    },
    {
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
      event: WORKFLOW_EVENTS.VERIFIER_FOUND_FINDINGS,
      expectedPhase: WORKFLOW_PHASES.FINDINGS_DECISION,
    },
    {
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
      event: WORKFLOW_EVENTS.VERIFIER_APPROVED,
      expectedPhase: WORKFLOW_PHASES.CANDIDATE_READY,
    },
    {
      phase: WORKFLOW_PHASES.FINDINGS_DECISION,
      event: WORKFLOW_EVENTS.REJECT_FINDINGS,
      expectedPhase: WORKFLOW_PHASES.CANDIDATE_READY,
    },
    {
      phase: WORKFLOW_PHASES.FINDINGS_DECISION,
      event: WORKFLOW_EVENTS.REQUEST_FIXES,
      expectedPhase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    },
  ])(
    'given $phase when $event occurs then the phase is $expectedPhase and the revision increases',
    ({ phase, event, expectedPhase }) => {
      expect(transitionWorkflow({ state: state(phase), event })).toMatchObject({
        revision: 2,
        phase: expectedPhase,
      });
    },
  );

  it('follows the normal workflow path', () => {
    const events: WorkflowEvent[] = [
      WORKFLOW_EVENTS.MARK_SPEC_READY,
      WORKFLOW_EVENTS.RUN_BUILDER,
      WORKFLOW_EVENTS.BUILDER_DONE,
      WORKFLOW_EVENTS.RUN_VERIFIER,
      WORKFLOW_EVENTS.VERIFIER_APPROVED,
    ];

    const finalState = events.reduce(
      (current, event) => transitionWorkflow({ state: current, event }),
      state(WORKFLOW_PHASES.DRAFTING_SPEC),
    );

    expect(finalState).toMatchObject({
      revision: 6,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
  });

  it('treats builder-failed as a sink', () => {
    for (const event of Object.values(WORKFLOW_EVENTS)) {
      expect(() =>
        transitionWorkflow({
          state: state(WORKFLOW_PHASES.BUILDER_FAILED, 3),
          event,
        }),
      ).toThrow('is not allowed from phase');
    }
  });

  it('given candidate-ready when any event is requested then the workflow stays concluded', () => {
    for (const event of Object.values(WORKFLOW_EVENTS)) {
      expect(() =>
        transitionWorkflow({
          state: state(WORKFLOW_PHASES.CANDIDATE_READY),
          event,
        }),
      ).toThrow('is not allowed from phase');
    }
  });

  it('does not mutate the input state', () => {
    const current = state(WORKFLOW_PHASES.READY_FOR_BUILDER, 4);

    transitionWorkflow({
      state: current,
      event: WORKFLOW_EVENTS.RUN_BUILDER,
    });

    expect(current).toEqual(state(WORKFLOW_PHASES.READY_FOR_BUILDER, 4));
  });
});
