/**
 * Objective: Select the escalation resolution event from the spec revision decision.
 * Used: When owner answers determine whether the spec must change.
 */

import { WORKFLOW_EVENTS, type WorkflowEvent } from '#workflow/state/schema.ts';

export const getWorkflowEventBySpecChangeRequired = (
  specChangeRequired: boolean,
): WorkflowEvent => {
  if (specChangeRequired) {
    return WORKFLOW_EVENTS.OWNER_REQUEST_SPEC_REVISION;
  }

  return WORKFLOW_EVENTS.RESOLVE_ESCALATION;
};
