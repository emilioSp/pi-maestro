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
  it('GIVEN valid workflow state for each supported phase WHEN validation runs THEN every phase is accepted and the schema forbids extra fields', () => {
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
    'GIVEN workflow state with $scenario WHEN validated THEN validation fails with an invalid workflow state error',
    ({ state }) => {
      expect(() => assertWorkflowState(state)).toThrow('Invalid workflow state');
    },
  );

  it('GIVEN a workflow spec ID containing February 30 WHEN state is validated THEN validation fails with an invalid spec ID error', () => {
    expect(() =>
      assertWorkflowState({
        ...validState,
        specId: '20260230-143052-add-weather-alerts',
      }),
    ).toThrow('Invalid workflow spec ID');
  });

  it('GIVEN null instead of workflow state WHEN validated THEN validation fails because state must be a JSON object', () => {
    expect(() => assertWorkflowState(null)).toThrow('Workflow state must be a JSON object.');
  });
});
