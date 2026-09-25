import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowEvent,
  type WorkflowPhase,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import {
  transitionWorkflow,
  WORKFLOW_TRANSITIONS,
} from '#workflow/transitions.ts';

const state = (phase: WorkflowPhase, revision = 1): WorkflowState => ({
  version: WORKFLOW_STATE_VERSION,
  specId: '20260321-143052-add-weather-alerts',
  revision,
  phase,
});

describe('workflow transitions', () => {
  it.each(
    Object.entries(WORKFLOW_TRANSITIONS) as [
      WorkflowEvent,
      (typeof WORKFLOW_TRANSITIONS)[WorkflowEvent],
    ][],
  )('allows every configured source phase for %s', (event, transition) => {
    for (const phase of transition.from) {
      expect(transitionWorkflow({ state: state(phase), event })).toMatchObject({
        revision: 2,
        phase: transition.to,
      });
    }
  });

  it('follows the normal workflow path', () => {
    const events: WorkflowEvent[] = [
      WORKFLOW_EVENTS.MARK_SPEC_READY,
      WORKFLOW_EVENTS.LAUNCH_BUILDER,
      WORKFLOW_EVENTS.BUILDER_DONE,
      WORKFLOW_EVENTS.LAUNCH_VERIFIER,
      WORKFLOW_EVENTS.VERIFIER_APPROVED,
      WORKFLOW_EVENTS.PREPARE_FINAL_REVIEW,
    ];

    const finalState = events.reduce(
      (current, event) => transitionWorkflow({ state: current, event }),
      state(WORKFLOW_PHASES.DRAFTING_SPEC),
    );

    expect(finalState).toMatchObject({
      revision: 7,
      phase: WORKFLOW_PHASES.FINAL_REVIEW,
    });
  });

  it('rejects retrying a running builder', () => {
    expect(() =>
      transitionWorkflow({
        state: state(WORKFLOW_PHASES.BUILDER_RUNNING, 3),
        event: WORKFLOW_EVENTS.RETRY_BUILDER,
      }),
    ).toThrow('is not allowed from phase');
  });

  it('rejects an event from an invalid phase', () => {
    expect(() =>
      transitionWorkflow({
        state: state(WORKFLOW_PHASES.FINAL_REVIEW),
        event: WORKFLOW_EVENTS.LAUNCH_BUILDER,
      }),
    ).toThrow('is not allowed from phase');
  });

  it('does not mutate the input state', () => {
    const current = state(WORKFLOW_PHASES.READY_FOR_BUILDER, 4);

    transitionWorkflow({
      state: current,
      event: WORKFLOW_EVENTS.LAUNCH_BUILDER,
    });

    expect(current).toEqual(state(WORKFLOW_PHASES.READY_FOR_BUILDER, 4));
  });
});
