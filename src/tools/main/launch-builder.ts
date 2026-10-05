/**
 * Objective: Launch and validate one foreground builder pass for the owner session.
 * Used: When the owner invokes the launch-builder tool.
 */

import { randomUUID } from 'node:crypto';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { Type } from 'typebox';
import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoff,
} from '#artifacts/builder-handoff/schema.ts';
import { readEscalationHistory } from '#artifacts/escalation/readEscalationHistory.ts';
import type { Escalation } from '#artifacts/escalation/schema.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { AGENTS, type MaestroConfig } from '#config/schema.ts';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';

export const LAUNCH_BUILDER_TOOL = {
  NAME: 'maestro_launch_builder',
  LABEL: 'Launch Builder',
  DESCRIPTION:
    'Launch the builder in the current checkout for an owner-approved spec. The builder runs in the foreground and cannot be retried after a committed failure.',
} as const;

const LaunchBuilderToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
  },
  { additionalProperties: false },
);

const MILLISECONDS_PER_MINUTE = 60_000;

const BUILDER_NODE_ID = 'builder';

// pi-subagents exports SubagentDelegationStatus as a type, not runtime values.
// TypeScript erases the type, so the adapter needs these constants for comparisons.
const DELEGATION_STATUSES = {
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

const isDelegationErrorStatus = (status: string): boolean =>
  status === DELEGATION_STATUSES.FAILED ||
  status === DELEGATION_STATUSES.INVALID_REQUEST ||
  status === DELEGATION_STATUSES.TOOL_BUDGET_EXHAUSTED ||
  status === DELEGATION_STATUSES.STRUCTURED_OUTPUT_FAILED ||
  status === DELEGATION_STATUSES.ACCEPTANCE_FAILED ||
  status === DELEGATION_STATUSES.UNAVAILABLE_CONTEXT ||
  status === DELEGATION_STATUSES.DUPLICATE_NODE;

type LaunchBuilderContext = {
  paths: MaestroPaths;
  builder: MaestroConfig['builder'];
};

type JsonObject = Record<string, unknown>;

type BuilderLaunchResult =
  | {
      outcome: typeof BUILDER_HANDOFF_STATUSES.DONE;
      specId: string;
      revision: number;
      phase: typeof WORKFLOW_PHASES.READY_FOR_VERIFIER;
      handoff: BuilderHandoff;
    }
  | {
      outcome: typeof BUILDER_HANDOFF_STATUSES.FAILED;
      specId: string;
      revision: number;
      phase: typeof WORKFLOW_PHASES.BUILDER_FAILED;
      handoff: BuilderHandoff;
    }
  | {
      outcome: typeof BUILDER_HANDOFF_STATUSES.ESCALATION;
      specId: string;
      revision: number;
      phase: typeof WORKFLOW_PHASES.ESCALATION_DECISION;
      escalation: Escalation;
    };

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asJsonObject = (value: unknown): JsonObject | undefined =>
  isJsonObject(value) ? value : undefined;

const isStringValue = (value: unknown): value is string =>
  typeof value === 'string';

type StringPropertyInput = {
  object: JsonObject;
  name: string;
};

const getStringProperty = ({
  object,
  name,
}: StringPropertyInput): string | undefined => {
  const value = object[name];

  return isStringValue(value) ? value : undefined;
};

const getResponseError = ({ response }: { response: JsonObject }): string =>
  getStringProperty({ object: response, name: 'error' }) ??
  'No delegation error details were provided.';

const matchesDelegationRequest = ({
  request,
  payload,
}: {
  request: SubagentDelegationRequest;
  payload: unknown;
}): boolean => {
  const response = asJsonObject(payload);

  if (response === undefined || response.requestId !== request.requestId) {
    return false;
  }

  return (
    (response.ownerRunId === undefined ||
      response.ownerRunId === request.ownerRunId) &&
    (response.nodeId === undefined || response.nodeId === request.nodeId)
  );
};

type WaitForDelegationResponseInput = {
  events: ExtensionAPI['events'];
  request: SubagentDelegationRequest;
};

const waitForDelegationResponse = async ({
  events,
  request,
}: WaitForDelegationResponseInput): Promise<unknown> => {
  let unsubscribe: (() => void) | undefined;

  try {
    const responsePromise = new Promise<unknown>((resolve) => {
      unsubscribe = events.on(SUBAGENT_DELEGATION_RESPONSE_EVENT, (payload) => {
        if (matchesDelegationRequest({ request, payload })) {
          resolve(payload);
        }
      });
    });

    try {
      events.emit(SUBAGENT_DELEGATION_REQUEST_EVENT, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Builder delegation error: ${message}`, {
        cause: error,
      });
    }

    return await responsePromise;
  } finally {
    unsubscribe?.();
  }
};

const resolveLaunchContext = async ({
  cwd,
}: {
  cwd: string;
}): Promise<LaunchBuilderContext> => {
  const repositoryRoot = await findRepositoryRoot({ cwd });
  const config = await loadConfiguration({ cwd: repositoryRoot });

  return {
    paths: new MaestroPaths({ repositoryRoot, config }),
    builder: config.builder,
  };
};

const createDelegationRequest = ({
  toolCallId,
  specId,
  repositoryRoot,
  builder,
}: {
  toolCallId: string;
  specId: string;
  repositoryRoot: string;
  builder: MaestroConfig['builder'];
}): SubagentDelegationRequest => ({
  requestId: randomUUID(),
  ownerRunId: toolCallId,
  nodeId: BUILDER_NODE_ID,
  // pi-subagents loads this name from agents/builder.md through package.json.
  // See docs/subagent-integration.md.
  agent: AGENTS.BUILDER,
  task: `Implement specId "${specId}" in the current checkout "${repositoryRoot}". Read all applicable AGENTS.md files before working.`,
  context: 'fresh',
  cwd: repositoryRoot,
  model: builder.model,
  thinking: builder.thinking,
  timeoutMs: builder.timeoutMinutes * MILLISECONDS_PER_MINUTE,
  result: { kind: 'text' },
});

const readCommittedBuilderResult = async ({
  paths,
  specId,
}: {
  paths: MaestroPaths;
  specId: string;
}): Promise<BuilderLaunchResult> => {
  try {
    const repositoryStatus = await getRepositoryStatus({
      repositoryRoot: paths.getRepositoryRoot(),
    });

    if (!repositoryStatus.clean) {
      throw new Error(
        'The builder returned without committing its final artifact and current work.',
      );
    }

    const state = await readWorkflowState({
      path: paths.getWorkflowPath(specId),
    });

    if (state.specId !== specId) {
      throw new Error(
        `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
      );
    }

    return await buildLaunchResult({ paths, specId, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Builder protocol error: ${message}.`, { cause: error });
  }
};

type BuildLaunchResultInput = {
  paths: MaestroPaths;
  specId: string;
  state: WorkflowState;
};

const buildLaunchResult = async ({
  paths,
  specId,
  state,
}: BuildLaunchResultInput): Promise<BuilderLaunchResult> => {
  if (state.phase === WORKFLOW_PHASES.READY_FOR_VERIFIER) {
    const handoff = await readBuilderHandoff({
      path: paths.getBuilderHandoffPath(specId),
      specId,
      revision: state.revision,
    });

    if (handoff.status !== BUILDER_HANDOFF_STATUSES.DONE) {
      throw new Error(
        `Builder handoff status does not match workflow phase "${state.phase}".`,
      );
    }

    return {
      outcome: BUILDER_HANDOFF_STATUSES.DONE,
      specId,
      revision: state.revision,
      phase: state.phase,
      handoff,
    };
  }

  if (state.phase === WORKFLOW_PHASES.BUILDER_FAILED) {
    const handoff = await readBuilderHandoff({
      path: paths.getBuilderHandoffPath(specId),
      specId,
      revision: state.revision,
    });

    if (handoff.status !== BUILDER_HANDOFF_STATUSES.FAILED) {
      throw new Error(
        `Builder handoff status does not match workflow phase "${state.phase}".`,
      );
    }

    return {
      outcome: BUILDER_HANDOFF_STATUSES.FAILED,
      specId,
      revision: state.revision,
      phase: state.phase,
      handoff,
    };
  }

  if (state.phase === WORKFLOW_PHASES.ESCALATION_DECISION) {
    const history = await readEscalationHistory({
      directory: paths.getEscalationsPath(specId),
      specId,
      currentRevision: state.revision,
    });

    const escalation = history.at(-1);

    if (
      escalation === undefined ||
      escalation.revision !== state.revision ||
      escalation.resolution !== null
    ) {
      throw new Error(
        'The builder escalation is missing, stale, or already resolved.',
      );
    }

    return {
      outcome: BUILDER_HANDOFF_STATUSES.ESCALATION,
      specId,
      revision: state.revision,
      phase: state.phase,
      escalation,
    };
  }

  throw new Error(
    `Builder returned with unexpected workflow phase "${state.phase}".`,
  );
};

const isTextResult = (value: unknown): boolean => {
  const result = asJsonObject(value);

  return (
    result !== undefined && result.kind === 'text' && isStringValue(result.text)
  );
};

type HandleDelegationResponseInput = {
  response: unknown;
  paths: MaestroPaths;
  specId: string;
};

const handleDelegationResponse = async ({
  response: payload,
  paths,
  specId,
}: HandleDelegationResponseInput): Promise<BuilderLaunchResult> => {
  const response = asJsonObject(payload);

  if (response === undefined) {
    throw new Error(
      'Builder protocol error: the final response is not an object.',
    );
  }

  const status = getStringProperty({ object: response, name: 'status' });

  if (status === DELEGATION_STATUSES.COMPLETED) {
    if (!isTextResult(response.result)) {
      throw new Error(
        'Builder protocol error: the completed response has no text result.',
      );
    }

    return await readCommittedBuilderResult({ paths, specId });
  }

  const error = getResponseError({ response });

  if (status === DELEGATION_STATUSES.TIMED_OUT) {
    throw new Error(`Builder timeout: ${error}`);
  }

  if (
    status === DELEGATION_STATUSES.INTERRUPTED ||
    status === DELEGATION_STATUSES.CANCELLED
  ) {
    throw new Error(`Builder interruption: ${error}`);
  }

  if (status !== undefined && isDelegationErrorStatus(status)) {
    throw new Error(`Builder delegation error: ${error}`);
  }

  if (status !== undefined) {
    throw new Error(
      `Builder protocol error: unsupported final response status "${status}".`,
    );
  }

  throw new Error('Builder protocol error: the final response has no status.');
};

const formatBuilderResult = ({
  result,
}: {
  result: BuilderLaunchResult;
}): string => {
  if (result.outcome === BUILDER_HANDOFF_STATUSES.DONE) {
    return `Builder completed spec ${result.specId}. The workflow is ready-for-verifier.`;
  }

  if (result.outcome === BUILDER_HANDOFF_STATUSES.FAILED) {
    return `Builder failed for spec ${result.specId}. The workflow is builder-failed and cannot be retried.`;
  }

  return `Builder opened escalation ${result.escalation.id} for spec ${result.specId}. The workflow is waiting for an owner decision.`;
};

export const registerLaunchBuilderTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: LAUNCH_BUILDER_TOOL.NAME,
    label: LAUNCH_BUILDER_TOOL.LABEL,
    description: LAUNCH_BUILDER_TOOL.DESCRIPTION,
    parameters: LaunchBuilderToolParameters,
    async execute(toolCallId, { specId }, _signal, _onUpdate, context) {
      const { paths, builder } = await resolveLaunchContext({
        cwd: context.cwd,
      });

      const launch = await prepareBuilderLaunch({ paths, specId });

      const request = createDelegationRequest({
        toolCallId,
        specId,
        repositoryRoot: launch.repositoryRoot,
        builder,
      });

      const response = await waitForDelegationResponse({
        events: pi.events,
        request,
      });

      const result = await handleDelegationResponse({
        response,
        paths,
        specId,
      });

      return {
        content: [{ type: 'text', text: formatBuilderResult({ result }) }],
        details: result,
      };
    },
  });
};
