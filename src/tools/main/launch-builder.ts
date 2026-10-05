/**
 * Objective: Launch and validate one foreground builder pass for the owner session.
 * Used: When the owner invokes the launch-builder tool.
 */

import { randomUUID } from 'node:crypto';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { SubagentDelegationRequest } from 'pi-subagents/delegation';
import { Type } from 'typebox';
import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoff,
} from '#artifacts/builder-handoff/schema.ts';
import { readEscalationHistory } from '#artifacts/escalation/readEscalationHistory.ts';
import type { Escalation } from '#artifacts/escalation/schema.ts';
import { AGENTS } from '#config/schema.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import {
  assertDelegationResponse,
  waitForDelegationResponse,
} from '#tools/utils/pi-subagent-delegation.ts';
import { resolveToolLaunchContext } from '#tools/utils/resolveToolLaunchContext.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
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
      const { paths, config } = await resolveToolLaunchContext({
        cwd: context.cwd,
      });

      const launch = await prepareBuilderLaunch({ paths, specId });

      const request: SubagentDelegationRequest = {
        requestId: randomUUID(),
        ownerRunId: toolCallId,
        nodeId: WORKFLOW_ROLES.BUILDER,
        // pi-subagents loads this name from agents/builder.md through package.json.
        // See docs/subagent-integration.md.
        agent: AGENTS.BUILDER,
        task: `Implement specId "${specId}" in the current checkout "${launch.repositoryRoot}". Read all applicable AGENTS.md files before working.`,
        context: 'fresh',
        cwd: launch.repositoryRoot,
        model: config.builder.model,
        thinking: config.builder.thinking,
        timeoutMs: config.builder.timeoutMinutes * MILLISECONDS_PER_MINUTE,
        result: { kind: 'text' },
      };

      const response = await waitForDelegationResponse({
        piEventsBus: pi.events,
        request,
      });

      assertDelegationResponse({ response });
      const result = await readCommittedBuilderResult({ paths, specId });

      return {
        content: [{ type: 'text', text: formatBuilderResult({ result }) }],
        details: result,
      };
    },
  });
};
