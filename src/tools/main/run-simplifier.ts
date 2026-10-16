/**
 * Objective: Run the simplifier in Git projects or explicitly skip unavailable Git.
 * Used: After verification succeeds or the owner rejects all findings.
 */

import { randomUUID } from 'node:crypto';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { SubagentDelegationRequest } from 'pi-subagents/delegation';
import { Type } from 'typebox';
import { readSimplifierHandoff } from '#artifacts/simplifier-handoff/readSimplifierHandoff.ts';
import { AGENTS } from '#config/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { refreshMaestroStatus } from '#maestro/status/refreshMaestroStatus.ts';
import {
  assertDelegationResponse,
  waitForDelegationResponse,
} from '#tools/utils/pi-subagent-delegation.ts';
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

const MILLISECONDS_PER_MINUTE = 60_000;

const GIT_SKIP_WARNING = 'Simplifier skipped: Git repository unavailable.';

type GitReadinessInput = {
  pi: ExtensionAPI;
  projectRoot: string;
};

const isGitReady = async ({
  pi,
  projectRoot,
}: GitReadinessInput): Promise<boolean> => {
  try {
    const result = await pi.exec(
      'git',
      ['rev-parse', '--is-inside-work-tree'],
      { cwd: projectRoot },
    );

    return result.code === 0 && result.stdout.trim() === 'true';
  } catch {
    return false;
  }
};

type ReadSimplifierResultInput = {
  paths: MaestroPaths;
  specId: string;
};

const readSimplifierResult = async ({
  paths,
  specId,
}: ReadSimplifierResultInput) => {
  try {
    const state = await readWorkflowState(paths.getWorkflowPath(specId));

    if (state.specId !== specId) {
      throw new Error(
        `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
      );
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
    async execute(toolCallId, { specId }, _signal, _onUpdate, context) {
      const { paths, config, projectRoot } = await resolveToolRunContext(
        context.cwd,
      );

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

      const request: SubagentDelegationRequest = {
        requestId: randomUUID(),
        ownerRunId: toolCallId,
        nodeId: WORKFLOW_ROLES.SIMPLIFIER,
        agent: AGENTS.SIMPLIFIER,
        task: `Simplify accepted code for specId "${specId}" in the project directory "${projectRoot}". Discover all current staged, unstaged, and untracked code changes with Git, including pre-existing changes.`,
        context: 'fresh',
        cwd: projectRoot,
        model: config.simplifier.model,
        thinking: config.simplifier.thinking,
        timeoutMs: config.simplifier.timeoutMinutes * MILLISECONDS_PER_MINUTE,
        result: { kind: 'text' },
      };

      const response = await waitForDelegationResponse({
        piEventsBus: pi.events,
        request,
      });

      assertDelegationResponse(response);
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
