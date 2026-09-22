import { describe, expect, it } from 'vitest';
import {
  validateWorkflowState,
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  WorkflowStateSchema,
} from '#workflow/state/schema.ts';

const validState = {
  version: WORKFLOW_STATE_VERSION,
  specId: '20260321-143052-add-weather-alerts',
  revision: 1,
  phase: WORKFLOW_PHASES.DRAFTING_SPEC,
  baseBranch: 'main',
};

describe('workflow state schema', () => {
  it('is closed and accepts every workflow phase', () => {
    expect(WorkflowStateSchema.type).toBe('object');
    expect(
      (WorkflowStateSchema as unknown as Record<string, unknown>)
        .additionalProperties,
    ).toBe(false);

    for (const phase of Object.values(WORKFLOW_PHASES)) {
      expect(validateWorkflowState({ ...validState, phase })).toEqual({
        ...validState,
        phase,
      });
    }
  });

  it.each([
    { ...validState, extra: true },
    { ...validState, version: '2.0.0' },
    { ...validState, revision: 0 },
    { ...validState, revision: 1.5 },
    { ...validState, specId: 'not-a-spec-id' },
    { ...validState, baseBranch: '' },
    { ...validState, phase: 'unknown' },
  ])('rejects an invalid state %#', (state) => {
    expect(() => validateWorkflowState(state)).toThrow(
      'Invalid workflow state',
    );
  });

  it('rejects a structurally valid ID with an invalid UTC date', () => {
    expect(() =>
      validateWorkflowState({
        ...validState,
        specId: '20260230-143052-add-weather-alerts',
      }),
    ).toThrow('Invalid workflow spec ID');
  });

  it('rejects non-object state', () => {
    expect(() => validateWorkflowState(null)).toThrow(
      'Workflow state must be a JSON object.',
    );
  });
});
