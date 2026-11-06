/**
 * Objective: Run and validate one foreground builder pass for the owner session.
 * Used: When the owner invokes the run-builder tool.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoff,
} from '#artifacts/builder-handoff/schema.ts';
import type { MaestroConfig } from '#config/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { refreshMaestroStatus } from '#maestro/status/refreshMaestroStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { executeRoleTask } from '#src/delegation/executeRoleTask.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, WORKFLOW_EVENTS, type WorkflowState } from '#workflow/state/schema.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export const RUN_BUILDER_TOOL = {
  NAME: 'maestro_run_builder',
  LABEL: 'Run Builder',
  DESCRIPTION:
    'Run the builder in the project directory for an owner-approved spec. The builder runs in the foreground and returns done or escalation. Owner decisions or renewed spec approval permit another pass after an escalation.',
} as const;

const RunBuilderToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
  },
  { additionalProperties: false },
);

type BuilderRunResult =
  | {
      outcome: typeof BUILDER_HANDOFF_STATUSES.DONE;
      specId: string;
      phase:
        | typeof WORKFLOW_PHASES.READY_FOR_VERIFIER
        | typeof WORKFLOW_PHASES.SIMPLIFIER_RUNNING
        | typeof WORKFLOW_PHASES.CANDIDATE_READY;
      handoff: BuilderHandoff;
    }
  | {
      outcome: typeof BUILDER_HANDOFF_STATUSES.ESCALATION;
      specId: string;
      phase: typeof WORKFLOW_PHASES.ESCALATION_DECISIONS;
      handoff: BuilderHandoff;
    };

type ReadBuilderResultInput = {
  config: MaestroConfig;
  builderRunningState: WorkflowState;
  paths: MaestroPaths;
  specId: string;
};

const readBuilderResult = async ({
  config,
  builderRunningState,
  paths,
  specId,
}: ReadBuilderResultInput): Promise<BuilderRunResult> => {
  try {
    const state = await readWorkflowState(paths.getWorkflowPath(specId));

    if (state.specId !== specId) {
      throw new Error(`Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`);
    }

    const donePhase = transitionWorkflow({
      state: builderRunningState,
      event: WORKFLOW_EVENTS.BUILDER_DONE,
      config,
    }).phase;

    if (
      state.phase !== WORKFLOW_PHASES.READY_FOR_VERIFIER &&
      state.phase !== WORKFLOW_PHASES.SIMPLIFIER_RUNNING &&
      state.phase !== WORKFLOW_PHASES.CANDIDATE_READY &&
      state.phase !== WORKFLOW_PHASES.ESCALATION_DECISIONS
    ) {
      throw new Error(`Builder returned with unexpected workflow phase "${state.phase}".`);
    }

    if (state.phase !== WORKFLOW_PHASES.ESCALATION_DECISIONS && state.phase !== donePhase) {
      throw new Error(`Builder returned with unexpected workflow phase "${state.phase}".`);
    }

    const handoff = await readBuilderHandoff({
      path: await paths.getActiveBuilderHandoffPath(specId),
      specId,
    });

    const expectedStatus =
      state.phase !== WORKFLOW_PHASES.ESCALATION_DECISIONS
        ? BUILDER_HANDOFF_STATUSES.DONE
        : BUILDER_HANDOFF_STATUSES.ESCALATION;

    if (handoff.status !== expectedStatus) {
      throw new Error(`Builder handoff status does not match workflow phase "${state.phase}".`);
    }

    if (state.phase !== WORKFLOW_PHASES.ESCALATION_DECISIONS) {
      return {
        outcome: BUILDER_HANDOFF_STATUSES.DONE,
        specId,
        phase: state.phase,
        handoff,
      };
    }

    if (handoff.escalations.some(({ resolution }) => resolution !== null)) {
      throw new Error('Current builder escalations already contain an owner resolution.');
    }

    return {
      outcome: BUILDER_HANDOFF_STATUSES.ESCALATION,
      specId,
      phase: state.phase,
      handoff,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Builder protocol error: ${message}.`, { cause: error });
  }
};

const formatBuilderResult = (result: BuilderRunResult): string => {
  if (result.outcome !== BUILDER_HANDOFF_STATUSES.DONE) {
    return `Builder submitted escalation questions for spec ${result.specId}. The workflow is waiting for an owner decision.`;
  }

  if (result.phase === WORKFLOW_PHASES.CANDIDATE_READY) {
    return `Builder completed spec ${result.specId}. The workflow is candidate-ready. Verifier and simplifier skipped by configuration. No independent verification was performed.`;
  }

  if (result.phase === WORKFLOW_PHASES.SIMPLIFIER_RUNNING) {
    return `Builder completed spec ${result.specId}. The workflow is simplifier-running. Verifier skipped by configuration. Call maestro_run_simplifier next.`;
  }

  return `Builder completed spec ${result.specId}. The workflow is ${result.phase}.`;
};

export const registerRunBuilderTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: RUN_BUILDER_TOOL.NAME,
    label: RUN_BUILDER_TOOL.LABEL,
    description: RUN_BUILDER_TOOL.DESCRIPTION,
    parameters: RunBuilderToolParameters,
    async execute(_toolCallId, { specId }, signal, onUpdate, context) {
      const { paths, config } = await resolveToolRunContext(context.cwd);

      const { projectRoot, state: builderRunningState } = await prepareBuilderRun({
        config,
        paths,
        specId,
      });

      await refreshMaestroStatus(context);

      await executeRoleTask({
        role: WORKFLOW_ROLES.BUILDER,
        prompt: `Implement specId "${specId}" in the project directory "${projectRoot}".`,
        cwd: projectRoot,
        model: config.builder.model,
        thinkingLevel: config.builder.thinking,
        signal,
        ui: context.ui,
        onUpdate,
      });

      const result = await readBuilderResult({ paths, specId, config, builderRunningState });

      return {
        content: [{ type: 'text', text: formatBuilderResult(result) }],
        details: result,
      };
    },
  });
};
