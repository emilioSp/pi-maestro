/**
 * Objective: Run and validate one foreground builder pass for the owner session.
 * Used: When the owner invokes the run-builder tool.
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
import { refreshMaestroStatus } from '#maestro/status/refreshMaestroStatus.ts';
import {
  assertDelegationResponse,
  waitForDelegationResponse,
} from '#tools/utils/pi-subagent-delegation.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';

export const RUN_BUILDER_TOOL = {
  NAME: 'maestro_run_builder',
  LABEL: 'Run Builder',
  DESCRIPTION:
    'Run the builder in the current checkout for an owner-approved spec. The builder runs in the foreground and cannot be retried after a committed failure.',
} as const;

const RunBuilderToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
  },
  { additionalProperties: false },
);

const MILLISECONDS_PER_MINUTE = 60_000;

type BuilderRunResult =
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

type ReadCommittedBuilderResultInput = {
  paths: MaestroPaths;
  specId: string;
};

const readCommittedBuilderResult = async ({
  paths,
  specId,
}: ReadCommittedBuilderResultInput): Promise<BuilderRunResult> => {
  try {
    const repositoryStatus = await getRepositoryStatus(
      paths.getRepositoryRoot(),
    );

    if (!repositoryStatus.clean) {
      throw new Error(
        'The builder returned without committing its final artifact and current work.',
      );
    }

    const state = await readWorkflowState(paths.getWorkflowPath(specId));

    if (state.specId !== specId) {
      throw new Error(
        `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
      );
    }

    return await buildRunResult({ paths, specId, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Builder protocol error: ${message}.`, { cause: error });
  }
};

type ReadTerminalBuilderResultInput = {
  paths: MaestroPaths;
  specId: string;
  revision: number;
  phase:
    | typeof WORKFLOW_PHASES.READY_FOR_VERIFIER
    | typeof WORKFLOW_PHASES.BUILDER_FAILED;
};

const readTerminalBuilderResult = async ({
  paths,
  specId,
  revision,
  phase,
}: ReadTerminalBuilderResultInput): Promise<BuilderRunResult> => {
  const handoff = await readBuilderHandoff({
    path: paths.getBuilderHandoffPath(specId),
    specId,
    revision,
  });

  const expectedStatus =
    phase === WORKFLOW_PHASES.READY_FOR_VERIFIER
      ? BUILDER_HANDOFF_STATUSES.DONE
      : BUILDER_HANDOFF_STATUSES.FAILED;

  if (handoff.status !== expectedStatus) {
    throw new Error(
      `Builder handoff status does not match workflow phase "${phase}".`,
    );
  }

  if (phase === WORKFLOW_PHASES.READY_FOR_VERIFIER) {
    return {
      outcome: BUILDER_HANDOFF_STATUSES.DONE,
      specId,
      revision,
      phase,
      handoff,
    };
  }

  return {
    outcome: BUILDER_HANDOFF_STATUSES.FAILED,
    specId,
    revision,
    phase,
    handoff,
  };
};

type BuildRunResultInput = {
  paths: MaestroPaths;
  specId: string;
  state: WorkflowState;
};

const buildRunResult = async ({
  paths,
  specId,
  state,
}: BuildRunResultInput): Promise<BuilderRunResult> => {
  if (
    state.phase === WORKFLOW_PHASES.READY_FOR_VERIFIER ||
    state.phase === WORKFLOW_PHASES.BUILDER_FAILED
  ) {
    return await readTerminalBuilderResult({
      paths,
      specId,
      revision: state.revision,
      phase: state.phase,
    });
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

const formatBuilderResult = (result: BuilderRunResult): string => {
  if (result.outcome === BUILDER_HANDOFF_STATUSES.DONE) {
    return `Builder completed spec ${result.specId}. The workflow is ready-for-verifier.`;
  }

  if (result.outcome === BUILDER_HANDOFF_STATUSES.FAILED) {
    return `Builder failed for spec ${result.specId}. The workflow is builder-failed and cannot be retried.`;
  }

  return `Builder opened escalation ${result.escalation.id} for spec ${result.specId}. The workflow is waiting for an owner decision.`;
};

export const registerRunBuilderTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: RUN_BUILDER_TOOL.NAME,
    label: RUN_BUILDER_TOOL.LABEL,
    description: RUN_BUILDER_TOOL.DESCRIPTION,
    parameters: RunBuilderToolParameters,
    async execute(toolCallId, { specId }, _signal, _onUpdate, context) {
      const { paths, config } = await resolveToolRunContext(context.cwd);

      const run = await prepareBuilderRun({ paths, specId });
      await refreshMaestroStatus(context);

      const request: SubagentDelegationRequest = {
        requestId: randomUUID(),
        ownerRunId: toolCallId,
        nodeId: WORKFLOW_ROLES.BUILDER,
        // pi-subagents loads this name from agents/builder.md through package.json.
        // See docs/subagent-integration.md.
        agent: AGENTS.BUILDER,
        task: `Implement specId "${specId}" in the current checkout "${run.repositoryRoot}". Read all applicable AGENTS.md files before working.`,
        context: 'fresh',
        cwd: run.repositoryRoot,
        model: config.builder.model,
        thinking: config.builder.thinking,
        timeoutMs: config.builder.timeoutMinutes * MILLISECONDS_PER_MINUTE,
        result: { kind: 'text' },
      };

      const response = await waitForDelegationResponse({
        piEventsBus: pi.events,
        request,
      });

      assertDelegationResponse(response);
      const result = await readCommittedBuilderResult({ paths, specId });

      return {
        content: [{ type: 'text', text: formatBuilderResult(result) }],
        details: result,
      };
    },
  });
};
