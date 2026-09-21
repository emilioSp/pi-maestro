import { type Static, Type } from 'typebox';
import { Value } from 'typebox/value';
import { isValidSpecId, SPEC_ID_PATTERN } from '#ids.ts';

export const WORKFLOW_STATE_VERSION = '1.0.0';

export const WORKFLOW_PHASES = [
  'drafting-spec',
  'ready-for-builder',
  'builder-running',
  'escalation-decision',
  'builder-failed',
  'ready-for-verifier',
  'verifier-running',
  'findings-decision',
  'candidate-ready',
  'final-review',
] as const;

export const WorkflowPhaseSchema = Type.Union([
  Type.Literal('drafting-spec'),
  Type.Literal('ready-for-builder'),
  Type.Literal('builder-running'),
  Type.Literal('escalation-decision'),
  Type.Literal('builder-failed'),
  Type.Literal('ready-for-verifier'),
  Type.Literal('verifier-running'),
  Type.Literal('findings-decision'),
  Type.Literal('candidate-ready'),
  Type.Literal('final-review'),
]);

export const WorkflowStateSchema = Type.Object(
  {
    version: Type.Literal(WORKFLOW_STATE_VERSION),
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    revision: Type.Integer({ minimum: 1 }),
    phase: WorkflowPhaseSchema,
    baseBranch: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type WorkflowPhase = Static<typeof WorkflowPhaseSchema>;
export type WorkflowState = Static<typeof WorkflowStateSchema>;

export const validateWorkflowState = (input: unknown): WorkflowState => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Workflow state must be a JSON object.');
  }

  const [error] = Value.Errors(WorkflowStateSchema, input);
  if (error !== undefined) {
    throw new Error(`Invalid workflow state: ${error.message}.`);
  }

  const state = input as WorkflowState;
  if (!isValidSpecId(state.specId)) {
    throw new Error(`Invalid workflow spec ID: "${state.specId}".`);
  }

  return state;
};
