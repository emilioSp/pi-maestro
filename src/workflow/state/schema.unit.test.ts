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
  it('given valid workflow state for each supported phase when validation runs then every phase is accepted and the schema forbids extra fields', () => {
    expect(WorkflowStateSchema.type).toBe('object');
    expect(ObjectOptions(WorkflowStateSchema).additionalProperties).toBe(false);

    for (const phase of Object.values(WORKFLOW_PHASES)) {
      expect(() => assertWorkflowState({ ...validState, phase })).not.toThrow();
    }
  });

  it.each([
    {
      scenario: 'an invalid spec ID',
      state: { ...validState, specId: 'not-a-spec-id' },
    },
    {
      scenario: 'an unknown phase',
      state: { ...validState, phase: 'unknown' },
    },
  ])(
    'given workflow state with $scenario when validated then validation fails with an invalid workflow state error',
    ({ state }) => {
      expect(() => assertWorkflowState(state)).toThrow('Invalid workflow state');
    },
  );

  it('given a workflow spec ID containing February 30 when state is validated then validation fails with an invalid spec ID error', () => {
    expect(() =>
      assertWorkflowState({
        ...validState,
        specId: '20260230-143052-add-weather-alerts',
      }),
    ).toThrow('Invalid workflow spec ID');
  });

  it('given null instead of workflow state when validated then validation fails because state must be a JSON object', () => {
    expect(() => assertWorkflowState(null)).toThrow('Workflow state must be a JSON object.');
  });
});
