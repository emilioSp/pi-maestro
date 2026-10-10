import { ObjectOptions } from 'typebox/type';
import { describe, expect, it } from 'vitest';
import {
  assertWorkflowState,
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  WorkflowStateSchema,
} from '#workflow/state/schema.ts';

const validState = {
  version: WORKFLOW_STATE_VERSION,
  specId: '20260321-143052-add-weather-alerts',
  phase: WORKFLOW_PHASES.DRAFTING_SPEC,
};

describe('workflow state schema', () => {
  it('given each supported workflow phase when state is validated then it is accepted by a closed schema', () => {
    expect(WorkflowStateSchema.type).toBe('object');
    expect(ObjectOptions(WorkflowStateSchema).additionalProperties).toBe(false);

    for (const phase of Object.values(WORKFLOW_PHASES)) {
      expect(() => assertWorkflowState({ ...validState, phase })).not.toThrow();
    }
  });

  it.each([
    { ...validState, specId: 'not-a-spec-id' },
    { ...validState, phase: 'unknown' },
  ])(
    'given invalid workflow state %# when validated then it is rejected',
    (state) => {
      expect(() => assertWorkflowState(state)).toThrow(
        'Invalid workflow state',
      );
    },
  );

  it('given a workflow spec ID with an invalid UTC date when state is validated then it is rejected', () => {
    expect(() =>
      assertWorkflowState({
        ...validState,
        specId: '20260230-143052-add-weather-alerts',
      }),
    ).toThrow('Invalid workflow spec ID');
  });

  it('given null workflow state when validated then it is rejected as a non-object', () => {
    expect(() => assertWorkflowState(null)).toThrow(
      'Workflow state must be a JSON object.',
    );
  });
});
