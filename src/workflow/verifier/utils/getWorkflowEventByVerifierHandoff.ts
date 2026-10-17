/**
 * Objective: Select the workflow event from a verifier handoff.
 * Used: When a verifier completes a pass or the owner resolves its findings.
 */

import { FINDING_DECISIONS, type VerifierHandoff } from '#artifacts/verifier-handoff/schema.ts';
import { WORKFLOW_EVENTS, type WorkflowEvent } from '#workflow/state/schema.ts';

export const getWorkflowEventByVerifierHandoff = (handoff: VerifierHandoff): WorkflowEvent => {
  if (handoff.findings.length === 0) {
    return WORKFLOW_EVENTS.VERIFIER_DONE;
  }

  if (handoff.findings.every(({ decision }) => decision === null)) {
    return WORKFLOW_EVENTS.VERIFIER_FOUND_FINDINGS;
  }

  if (
    handoff.findings.some(({ decision }) => decision?.decision === FINDING_DECISIONS.REVISE_SPEC)
  ) {
    return WORKFLOW_EVENTS.OWNER_REQUEST_SPEC_REVISION;
  }

  if (handoff.findings.some(({ decision }) => decision?.decision === FINDING_DECISIONS.FIX_CODE)) {
    return WORKFLOW_EVENTS.OWNER_REQUEST_FIXES;
  }

  if (handoff.findings.every(({ decision }) => decision?.decision === FINDING_DECISIONS.REJECT)) {
    return WORKFLOW_EVENTS.OWNER_REJECT_FINDINGS;
  }

  throw new Error('Unexpected verifier finding decisions.');
};
