/**
 * Objective: Resolve the agent responsible for a workflow phase.
 * Used: When workflow logic maps persisted phases to agent roles.
 */

import type { WorkflowRole } from '#workflow/roles.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';

const BUILDER_PHASES: readonly WorkflowState['phase'][] = [
  WORKFLOW_PHASES.BUILDER_RUNNING,
  WORKFLOW_PHASES.ESCALATION_DECISIONS,
  WORKFLOW_PHASES.READY_FOR_VERIFIER,
];

const VERIFIER_PHASES: readonly WorkflowState['phase'][] = [
  WORKFLOW_PHASES.VERIFIER_RUNNING,
  WORKFLOW_PHASES.FINDING_DECISIONS,
];

export const getAgentRole = (phase: WorkflowState['phase']): WorkflowRole | null => {
  if (BUILDER_PHASES.includes(phase)) {
    return WORKFLOW_ROLES.BUILDER;
  }

  if (VERIFIER_PHASES.includes(phase)) {
    return WORKFLOW_ROLES.VERIFIER;
  }

  if (phase === WORKFLOW_PHASES.SIMPLIFIER_RUNNING) {
    return WORKFLOW_ROLES.SIMPLIFIER;
  }

  return null;
};
