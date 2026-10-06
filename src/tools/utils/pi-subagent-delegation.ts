/**
 * Objective: Coordinate foreground pi-subagents delegation responses.
 * Used: By Pi tools that run pi-subagents agents.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
  type SubagentDelegationResponse,
} from 'pi-subagents/delegation';

// pi-subagents exports SubagentDelegationStatus as a type, not runtime values.
// TypeScript erases the type, so the adapter needs these constants for comparisons.
export const DELEGATION_STATUSES = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMED_OUT: 'timed_out',
  INTERRUPTED: 'interrupted',
  CANCELLED: 'cancelled',
  INVALID_REQUEST: 'invalid_request',
  TOOL_BUDGET_EXHAUSTED: 'tool_budget_exhausted',
  STRUCTURED_OUTPUT_FAILED: 'structured_output_failed',
  ACCEPTANCE_FAILED: 'acceptance_failed',
  UNAVAILABLE_CONTEXT: 'unavailable_context',
  DUPLICATE_NODE: 'duplicate_node',
} as const;

export const isDelegationErrorStatus = (status: string): boolean =>
  status === DELEGATION_STATUSES.FAILED ||
  status === DELEGATION_STATUSES.INVALID_REQUEST ||
  status === DELEGATION_STATUSES.TOOL_BUDGET_EXHAUSTED ||
  status === DELEGATION_STATUSES.STRUCTURED_OUTPUT_FAILED ||
  status === DELEGATION_STATUSES.ACCEPTANCE_FAILED ||
  status === DELEGATION_STATUSES.UNAVAILABLE_CONTEXT ||
  status === DELEGATION_STATUSES.DUPLICATE_NODE;

type MatchesDelegationRequestInput = {
  request: SubagentDelegationRequest;
  payload: unknown;
};

export const matchesDelegationRequest = ({
  request,
  payload,
}: MatchesDelegationRequestInput): boolean => {
  // JUSTIFICATION: pi-subagents owns this event contract and emits a terminal response for every matching request.
  const response = payload as SubagentDelegationResponse;

  return (
    response.requestId === request.requestId &&
    (response.ownerRunId === undefined ||
      response.ownerRunId === request.ownerRunId) &&
    (response.nodeId === undefined || response.nodeId === request.nodeId)
  );
};

type WaitForDelegationResponseInput = {
  piEventsBus: ExtensionAPI['events'];
  request: SubagentDelegationRequest;
};

export const waitForDelegationResponse = async ({
  piEventsBus,
  request,
}: WaitForDelegationResponseInput): Promise<SubagentDelegationResponse> => {
  const { promise, resolve } =
    Promise.withResolvers<SubagentDelegationResponse>();

  const unsubscribe = piEventsBus.on(
    SUBAGENT_DELEGATION_RESPONSE_EVENT,
    (payload) => {
      if (!matchesDelegationRequest({ request, payload })) {
        return;
      }

      // JUSTIFICATION: matchesDelegationRequest accepts only the response for this pi-subagents request.
      resolve(payload as SubagentDelegationResponse);
    },
  );

  try {
    try {
      piEventsBus.emit(SUBAGENT_DELEGATION_REQUEST_EVENT, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Delegation request error: ${message}`, {
        cause: error,
      });
    }

    return await promise;
  } finally {
    unsubscribe();
  }
};

export function assertDelegationResponse(
  response: SubagentDelegationResponse,
): void {
  if (response.status === DELEGATION_STATUSES.COMPLETED) {
    return;
  }

  const error = response.error ?? 'No delegation error details were provided.';

  if (response.status === DELEGATION_STATUSES.TIMED_OUT) {
    throw new Error(`Delegation timeout: ${error}`);
  }

  if (
    response.status === DELEGATION_STATUSES.INTERRUPTED ||
    response.status === DELEGATION_STATUSES.CANCELLED
  ) {
    throw new Error(`Delegation interruption: ${error}`);
  }

  if (isDelegationErrorStatus(response.status)) {
    throw new Error(`Delegation error: ${error}`);
  }

  throw new Error(
    `Protocol error: unsupported final response status "${response.status}".`,
  );
}
