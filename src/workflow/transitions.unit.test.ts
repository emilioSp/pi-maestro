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
  it.each([WORKFLOW_PHASES.ESCALATION_DECISIONS, WORKFLOW_PHASES.FINDING_DECISIONS])(
    'given a workflow in %s when the owner requests a spec revision then the workflow returns to drafting-spec',
    (phase) => {
      expect(
        transitionWorkflow({
          state: state(phase),
          event: WORKFLOW_EVENTS.OWNER_REQUEST_SPEC_REVISION,
        }),
      ).toEqual(state(WORKFLOW_PHASES.DRAFTING_SPEC));
    },
  );

  it('given a workflow in candidate-ready when any transition is requested then every request throws an error because the workflow is complete', () => {
    for (const event of Object.values(WORKFLOW_EVENTS)) {
      expect(() =>
        transitionWorkflow({
          state: state(WORKFLOW_PHASES.CANDIDATE_READY),
          event,
        }),
      ).toThrow('is not allowed from phase');
    }
  });

  it('given a workflow in ready-for-builder when the builder run transition is calculated then the original state object remains unchanged', () => {
    const current = state(WORKFLOW_PHASES.READY_FOR_BUILDER);

    transitionWorkflow({
      state: current,
      event: WORKFLOW_EVENTS.RUN_BUILDER,
    });

    expect(current).toEqual(state(WORKFLOW_PHASES.READY_FOR_BUILDER));
  });
});
