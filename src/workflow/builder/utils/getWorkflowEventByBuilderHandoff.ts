/**
 * Objective: Select the workflow event from a builder handoff.
 * Used: When a builder completes a pass with done or escalation.
 */

import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoff,
} from '#artifacts/builder-handoff/schema.ts';
import { WORKFLOW_EVENTS, type WorkflowEvent } from '#workflow/state/schema.ts';

export const getWorkflowEventByBuilderHandoff = ({
  status,
}: BuilderHandoff): WorkflowEvent => {
  if (status === BUILDER_HANDOFF_STATUSES.DONE) {
    return WORKFLOW_EVENTS.BUILDER_DONE;
  }

  if (status === BUILDER_HANDOFF_STATUSES.ESCALATION) {
    return WORKFLOW_EVENTS.BUILDER_OPEN_ESCALATIONS;
  }

  throw new Error(`Unexpected builder handoff status: "${status}".`);
};
