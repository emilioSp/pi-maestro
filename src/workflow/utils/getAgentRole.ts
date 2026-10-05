/**
 * Objective: Resolve the agent responsible for a workflow phase.
 * Used: When workflow logic maps persisted phases to builder or verifier roles.
 */

import type { WorkflowRole } from '#workflow/roles.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';

const BUILDER_PHASES: readonly WorkflowState['phase'][] = [
  WORKFLOW_PHASES.BUILDER_RUNNING,
  WORKFLOW_PHASES.ESCALATION_DECISION,
  WORKFLOW_PHASES.READY_FOR_VERIFIER,
];

const VERIFIER_PHASES: readonly WorkflowState['phase'][] = [
  WORKFLOW_PHASES.VERIFIER_RUNNING,
  WORKFLOW_PHASES.FINDINGS_DECISION,
];

export const getAgentRole = (
  phase: WorkflowState['phase'],
): WorkflowRole | null => {
  if (BUILDER_PHASES.includes(phase)) {
    return WORKFLOW_ROLES.BUILDER;
  }

  if (VERIFIER_PHASES.includes(phase)) {
    return WORKFLOW_ROLES.VERIFIER;
  }

  return null;
};
