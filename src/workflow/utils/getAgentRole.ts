/**
 * Objective: Resolve the agent responsible for a workflow phase.
 * Used: When workflow logic maps persisted phases to builder or verifier roles.
 */

import type { WorkflowRole } from '#workflow/roles.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';

export const getAgentRole = (
  phase: WorkflowState['phase'],
): WorkflowRole | null => {
  if (
    (
      [
        WORKFLOW_PHASES.BUILDER_RUNNING,
        WORKFLOW_PHASES.ESCALATION_DECISION,
        WORKFLOW_PHASES.READY_FOR_VERIFIER,
      ] as WorkflowState['phase'][]
    ).includes(phase)
  ) {
    return WORKFLOW_ROLES.BUILDER;
  }

  if (
    (
      [
        WORKFLOW_PHASES.VERIFIER_RUNNING,
        WORKFLOW_PHASES.FINDINGS_DECISION,
        WORKFLOW_PHASES.CANDIDATE_READY,
      ] as WorkflowState['phase'][]
    ).includes(phase)
  ) {
    return WORKFLOW_ROLES.VERIFIER;
  }

  return null;
};
