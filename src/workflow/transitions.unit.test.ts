import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowPhase,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

const state = (phase: WorkflowPhase): WorkflowState => ({
  version: WORKFLOW_STATE_VERSION,
  specId: '20260321-143052-add-weather-alerts',
  phase,
});

describe('workflow transitions', () => {
  it('given builder-failed when any event is requested then the transition is rejected', () => {
    for (const event of Object.values(WORKFLOW_EVENTS)) {
      expect(() =>
        transitionWorkflow({
          state: state(WORKFLOW_PHASES.BUILDER_FAILED),
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

  it('given ready-for-builder state when the builder run transition is applied then the input state is unchanged', () => {
    const current = state(WORKFLOW_PHASES.READY_FOR_BUILDER);

    transitionWorkflow({
      state: current,
      event: WORKFLOW_EVENTS.RUN_BUILDER,
    });

    expect(current).toEqual(state(WORKFLOW_PHASES.READY_FOR_BUILDER));
  });
});
