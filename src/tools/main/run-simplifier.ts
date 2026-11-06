/**
 * Objective: Run the simplifier in Git projects or explicitly skip unavailable Git.
 * Used: After verification succeeds or the owner rejects all findings.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { readSimplifierHandoff } from '#artifacts/simplifier-handoff/readSimplifierHandoff.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { refreshMaestroStatus } from '#maestro/status/refreshMaestroStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { executeRoleTask } from '#tools/utils/executeRoleTask.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export const RUN_SIMPLIFIER_TOOL = {
  NAME: 'maestro_run_simplifier',
  LABEL: 'Run Simplifier',
  DESCRIPTION:
    'Run the simplifier in the foreground from simplifier-running. If Git readiness cannot be confirmed, warn and complete without delegation.',
} as const;

const RunSimplifierToolParameters = Type.Object(
  { specId: Type.String({ pattern: SPEC_ID_PATTERN.source }) },
  { additionalProperties: false },
);

const GIT_SKIP_WARNING = 'Simplifier skipped: Git repository unavailable.';

type GitReadinessInput = {
  pi: ExtensionAPI;
  projectRoot: string;
};

const isGitReady = async ({ pi, projectRoot }: GitReadinessInput): Promise<boolean> => {
  try {
    const result = await pi.exec('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: projectRoot,
    });

    return result.code === 0 && result.stdout.trim() === 'true';
  } catch {
    return false;
  }
};

type ReadSimplifierResultInput = {
  paths: MaestroPaths;
  specId: string;
};

const readSimplifierResult = async ({ paths, specId }: ReadSimplifierResultInput) => {
  try {
    const state = await readWorkflowState(paths.getWorkflowPath(specId));

    if (state.specId !== specId) {
      throw new Error(`Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`);
    }

    if (state.phase !== WORKFLOW_PHASES.CANDIDATE_READY) {
      throw new Error(
        `The simplifier returned without recording a valid terminal handoff. Workflow phase is "${state.phase}".`,
      );
    }

    const handoff = await readSimplifierHandoff({
      path: paths.getSimplifierHandoffPath(specId),
      specId,
      projectRoot: paths.getProjectRoot(),
    });

    return { specId, phase: state.phase, outcome: state.phase, handoff };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Simplifier protocol error: ${message}`, { cause: error });
  }
};

export const registerRunSimplifierTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: RUN_SIMPLIFIER_TOOL.NAME,
    label: RUN_SIMPLIFIER_TOOL.LABEL,
    description: RUN_SIMPLIFIER_TOOL.DESCRIPTION,
    parameters: RunSimplifierToolParameters,
    async execute(_toolCallId, { specId }, signal, _onUpdate, context) {
      const { paths, config, projectRoot } = await resolveToolRunContext(context.cwd);

      const workflowPath = paths.getWorkflowPath(specId);
      const state = await readWorkflowState(workflowPath);

      if (state.specId !== specId) {
        throw new Error(
          `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
        );
      }

      if (state.phase !== WORKFLOW_PHASES.SIMPLIFIER_RUNNING) {
        throw new Error(
          `Simplifier run requires simplifier-running state, found "${state.phase}".`,
        );
      }

      await refreshMaestroStatus(context);

      if (!(await isGitReady({ pi, projectRoot }))) {
        const nextState = transitionWorkflow({
          config,
          state,
          event: WORKFLOW_EVENTS.SIMPLIFIER_SKIPPED,
        });

        await writeWorkflowState({ path: workflowPath, state: nextState });
        context.ui.notify(GIT_SKIP_WARNING, 'warning');

        return {
          content: [{ type: 'text', text: GIT_SKIP_WARNING }],
          details: {
            specId,
            phase: nextState.phase,
            skipped: true,
            warning: GIT_SKIP_WARNING,
          },
        };
      }

      await executeRoleTask({
        role: WORKFLOW_ROLES.SIMPLIFIER,
        prompt: `Simplify accepted code for specId "${specId}" in the project directory "${projectRoot}". Discover all current staged, unstaged, and untracked code changes with Git, including pre-existing changes.`,
        cwd: projectRoot,
        model: config.simplifier.model,
        thinkingLevel: config.simplifier.thinking,
        signal,
        ui: context.ui,
      });

      const result = await readSimplifierResult({ paths, specId });

      return {
        content: [
          {
            type: 'text',
            text: `Simplifier completed spec ${specId}. The workflow is candidate-ready. Report the saved simplifier summary and notes as its report, not verifier evidence.`,
          },
        ],
        details: result,
      };
    },
  });
};
