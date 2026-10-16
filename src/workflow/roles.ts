/**
 * Objective: Define the roles used by the Maestro workflow.
 * Used: When workflow code identifies agent responsibilities.
 */

export const WORKFLOW_ROLES = {
  BUILDER: 'builder',
  VERIFIER: 'verifier',
  SIMPLIFIER: 'simplifier',
} as const;

export type WorkflowRole = (typeof WORKFLOW_ROLES)[keyof typeof WORKFLOW_ROLES];
