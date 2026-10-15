/**
 * Objective: Define and validate the workflow state contract.
 * Used: Whenever Maestro reads or writes workflow state.
 */

import { type Static, Type } from 'typebox';
import { Value } from 'typebox/value';
import { isValidSpecId, SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';

export const WORKFLOW_STATE_VERSION = '1.0.0';

export const WORKFLOW_PHASES = {
  DRAFTING_SPEC: 'drafting-spec',
  READY_FOR_BUILDER: 'ready-for-builder',
  BUILDER_RUNNING: 'builder-running',
  ESCALATION_DECISION: 'escalation-decision',
  READY_FOR_VERIFIER: 'ready-for-verifier',
  VERIFIER_RUNNING: 'verifier-running',
  FINDINGS_DECISION: 'findings-decision',
  CANDIDATE_READY: 'candidate-ready',
} as const;

export const WORKFLOW_EVENTS = {
  MARK_SPEC_READY: 'mark-spec-ready',
  RUN_BUILDER: 'run-builder',
  BUILDER_OPEN_ESCALATIONS: 'builder-open-escalations',
  RESOLVE_ESCALATION: 'resolve-escalation',
  OWNER_REQUEST_SPEC_REVISION: 'owner-request-spec-revision',
  BUILDER_DONE: 'builder-done',
  RUN_VERIFIER: 'run-verifier',
  VERIFIER_FOUND_FINDINGS: 'verifier-found-findings',
  VERIFIER_DONE: 'verifier-done',
  OWNER_REJECT_FINDINGS: 'owner-reject-findings',
  OWNER_REQUEST_FIXES: 'owner-request-fixes',
} as const;

export const WorkflowPhaseSchema = Type.Union([
  Type.Literal(WORKFLOW_PHASES.DRAFTING_SPEC),
  Type.Literal(WORKFLOW_PHASES.READY_FOR_BUILDER),
  Type.Literal(WORKFLOW_PHASES.BUILDER_RUNNING),
  Type.Literal(WORKFLOW_PHASES.ESCALATION_DECISION),
  Type.Literal(WORKFLOW_PHASES.READY_FOR_VERIFIER),
  Type.Literal(WORKFLOW_PHASES.VERIFIER_RUNNING),
  Type.Literal(WORKFLOW_PHASES.FINDINGS_DECISION),
  Type.Literal(WORKFLOW_PHASES.CANDIDATE_READY),
]);

export const WorkflowStateSchema = Type.Object(
  {
    version: Type.Literal(WORKFLOW_STATE_VERSION),
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    phase: WorkflowPhaseSchema,
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

export function assertWorkflowState(
  input: unknown,
): asserts input is WorkflowState {
  assertWorkflowStateSchema(input);

  if (!isValidSpecId(input.specId)) {
    throw new Error(`Invalid workflow spec ID: "${input.specId}".`);
  }
}
