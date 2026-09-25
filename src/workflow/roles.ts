/**
 * Objective: Define the roles used by the Maestro workflow.
 * Used: When workflow code identifies builder and verifier responsibilities.
 */

export const WORKFLOW_ROLES = {
  BUILDER: 'builder',
  VERIFIER: 'verifier',
} as const;

export type WorkflowRole = (typeof WORKFLOW_ROLES)[keyof typeof WORKFLOW_ROLES];
