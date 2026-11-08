import { describe, expect, it } from 'vitest';

import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
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
          config: TEST_CONFIG,
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
          config: TEST_CONFIG,
          state: state(WORKFLOW_PHASES.CANDIDATE_READY),
          event,
        }),
      ).toThrow('is not allowed from phase');
    }
  });

  it('given a workflow in ready-for-builder when the builder run transition is calculated then the original state object remains unchanged', () => {
    const current = state(WORKFLOW_PHASES.READY_FOR_BUILDER);

    transitionWorkflow({
      config: TEST_CONFIG,
      state: current,
      event: WORKFLOW_EVENTS.RUN_BUILDER,
    });

    expect(current).toEqual(state(WORKFLOW_PHASES.READY_FOR_BUILDER));
  });
});

it('given a frozen draft and configuration with builder disabled when approval is calculated then only the returned state reaches candidate-ready', () => {
  const current = Object.freeze(state(WORKFLOW_PHASES.DRAFTING_SPEC));

  const config = Object.freeze({
    ...TEST_CONFIG,
    builder: Object.freeze({ ...TEST_CONFIG.builder, required: false }),
    verifier: Object.freeze({ ...TEST_CONFIG.verifier }),
    simplifier: Object.freeze({ ...TEST_CONFIG.simplifier }),
  });

  expect(
    transitionWorkflow({ state: current, event: WORKFLOW_EVENTS.MARK_SPEC_READY, config }),
  ).toEqual(state(WORKFLOW_PHASES.CANDIDATE_READY));
  expect(current).toEqual(state(WORKFLOW_PHASES.DRAFTING_SPEC));
  expect(config.builder.required).toBe(false);
});
