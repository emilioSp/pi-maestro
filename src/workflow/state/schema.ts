/**
 * Objective: Define and validate the workflow state contract.
 * Used: Whenever Maestro reads or writes workflow state.
 * Entrypoint: validateWorkflowState().
 */

import { type Static, Type } from 'typebox';
import { Value } from 'typebox/value';
import { isValidSpecId, SPEC_ID_PATTERN } from '#ids.ts';

export const WORKFLOW_STATE_VERSION = '1.0.0';

export const WORKFLOW_PHASES = {
  DRAFTING_SPEC: 'drafting-spec',
  READY_FOR_BUILDER: 'ready-for-builder',
  BUILDER_RUNNING: 'builder-running',
  ESCALATION_DECISION: 'escalation-decision',
  BUILDER_FAILED: 'builder-failed',
  READY_FOR_VERIFIER: 'ready-for-verifier',
  VERIFIER_RUNNING: 'verifier-running',
  FINDINGS_DECISION: 'findings-decision',
  CANDIDATE_READY: 'candidate-ready',
  FINAL_REVIEW: 'final-review',
} as const;

export const WORKFLOW_EVENTS = {
  MARK_SPEC_READY: 'mark-spec-ready',
  LAUNCH_BUILDER: 'launch-builder',
  RETRY_BUILDER: 'retry-builder',
  OPEN_ESCALATION: 'open-escalation',
  RESOLVE_ESCALATION: 'resolve-escalation',
  BUILDER_FAILED: 'builder-failed',
  BUILDER_DONE: 'builder-done',
  LAUNCH_VERIFIER: 'launch-verifier',
  RETRY_VERIFIER: 'retry-verifier',
  VERIFIER_FOUND_FINDINGS: 'verifier-found-findings',
  VERIFIER_APPROVED: 'verifier-approved',
  REJECT_FINDINGS: 'reject-findings',
  REQUEST_FIXES: 'request-fixes',
  PREPARE_FINAL_REVIEW: 'prepare-final-review',
} as const;

export const WorkflowPhaseSchema = Type.Union([
  Type.Literal(WORKFLOW_PHASES.DRAFTING_SPEC),
  Type.Literal(WORKFLOW_PHASES.READY_FOR_BUILDER),
  Type.Literal(WORKFLOW_PHASES.BUILDER_RUNNING),
  Type.Literal(WORKFLOW_PHASES.ESCALATION_DECISION),
  Type.Literal(WORKFLOW_PHASES.BUILDER_FAILED),
  Type.Literal(WORKFLOW_PHASES.READY_FOR_VERIFIER),
  Type.Literal(WORKFLOW_PHASES.VERIFIER_RUNNING),
  Type.Literal(WORKFLOW_PHASES.FINDINGS_DECISION),
  Type.Literal(WORKFLOW_PHASES.CANDIDATE_READY),
  Type.Literal(WORKFLOW_PHASES.FINAL_REVIEW),
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

export type WorkflowPhase =
  (typeof WORKFLOW_PHASES)[keyof typeof WORKFLOW_PHASES];
export type WorkflowEvent =
  (typeof WORKFLOW_EVENTS)[keyof typeof WORKFLOW_EVENTS];
export type WorkflowState = Static<typeof WorkflowStateSchema>;

function assertWorkflowStateSchema(
  input: unknown,
): asserts input is WorkflowState {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Workflow state must be a JSON object.');
  }

  const [error] = Value.Errors(WorkflowStateSchema, input);
  if (error !== undefined) {
    throw new Error(`Invalid workflow state: ${error.message}.`);
  }
}

export const validateWorkflowState = (input: unknown): WorkflowState => {
  assertWorkflowStateSchema(input);
  if (!isValidSpecId(input.specId)) {
    throw new Error(`Invalid workflow spec ID: "${input.specId}".`);
  }

  return input;
};
