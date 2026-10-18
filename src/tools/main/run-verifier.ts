/**
 * Objective: Run and validate one foreground verifier pass for the owner session.
 * Used: When the owner invokes the run-verifier tool.
 */

import { randomUUID } from 'node:crypto';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { SubagentDelegationRequest } from 'pi-subagents/delegation';
import { Type } from 'typebox';

import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import type { VerifierHandoff } from '#artifacts/verifier-handoff/schema.ts';
import { AGENTS } from '#config/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { refreshMaestroStatus } from '#maestro/status/refreshMaestroStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import {
  assertDelegationResponse,
  waitForDelegationResponse,
} from '#tools/utils/pi-subagent-delegation.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

export const RUN_VERIFIER_TOOL = {
  NAME: 'maestro_run_verifier',
  LABEL: 'Run Verifier',
  DESCRIPTION:
    'Run the verifier in the project directory for a completed builder candidate. The verifier runs in the foreground.',
} as const;

const RunVerifierToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
  },
  { additionalProperties: false },
);

const MILLISECONDS_PER_MINUTE = 60_000;

type VerifierTerminalPhase =
  | typeof WORKFLOW_PHASES.SIMPLIFIER_RUNNING
  | typeof WORKFLOW_PHASES.FINDING_DECISIONS;

type VerifierRunResult = {
  outcome: VerifierTerminalPhase;
  specId: string;
  phase: VerifierTerminalPhase;
  handoff: VerifierHandoff;
};

type ReadVerifierResultInput = {
  paths: MaestroPaths;
  specId: string;
};

const readVerifierResult = async ({
  paths,
  specId,
}: ReadVerifierResultInput): Promise<VerifierRunResult> => {
  try {
    const state = await readWorkflowState(paths.getWorkflowPath(specId));

    if (state.specId !== specId) {
      throw new Error(`Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`);
    }

    if (state.phase === WORKFLOW_PHASES.VERIFIER_RUNNING) {
      throw new Error('The verifier returned without recording a valid terminal handoff.');
    }

    if (
      state.phase !== WORKFLOW_PHASES.SIMPLIFIER_RUNNING &&
      state.phase !== WORKFLOW_PHASES.FINDING_DECISIONS
    ) {
      throw new Error(`Verifier returned with unexpected workflow phase "${state.phase}".`);
    }

    const handoff = await readVerifierHandoff({
      path: await paths.getActiveVerifierHandoffPath(specId),
      specId,
    });

    const expectedPhase =
      handoff.findings.length > 0
        ? WORKFLOW_PHASES.FINDING_DECISIONS
        : WORKFLOW_PHASES.SIMPLIFIER_RUNNING;

    if (state.phase !== expectedPhase) {
      throw new Error(`Verifier handoff findings do not match workflow phase "${state.phase}".`);
    }

    return {
      specId,
      handoff,
      outcome: state.phase,
      phase: state.phase,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Verifier protocol error: ${message}.`, { cause: error });
  }
};

const formatVerifierResult = (result: VerifierRunResult): string => {
  if (result.outcome === WORKFLOW_PHASES.SIMPLIFIER_RUNNING) {
    return `Verifier completed spec ${result.specId}. The workflow is simplifier-running. Call maestro_run_simplifier next with this specId, without another approval or verifier pass.`;
  }

  return `Verifier found ${result.handoff.findings.length} finding(s) for spec ${result.specId}. The workflow is waiting for owner decisions.`;
};

export const registerRunVerifierTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: RUN_VERIFIER_TOOL.NAME,
    label: RUN_VERIFIER_TOOL.LABEL,
    description: RUN_VERIFIER_TOOL.DESCRIPTION,
    parameters: RunVerifierToolParameters,
    async execute(toolCallId, { specId }, _signal, _onUpdate, context) {
      const { paths, config } = await resolveToolRunContext(context.cwd);

      const run = await prepareVerifierRun({ paths, specId });
      await refreshMaestroStatus(context);

      const request: SubagentDelegationRequest = {
        requestId: randomUUID(),
        ownerRunId: toolCallId,
        nodeId: WORKFLOW_ROLES.VERIFIER,
        // pi-subagents loads this name from agents/verifier.md through package.json.
        agent: AGENTS.VERIFIER,
        task: `Verify specId "${specId}" in the live project directory "${run.projectRoot}"`,
        context: 'fresh',
        cwd: run.projectRoot,
        model: config.verifier.model,
        thinking: config.verifier.thinking,
        timeoutMs: config.verifier.timeoutMinutes * MILLISECONDS_PER_MINUTE,
        result: { kind: 'text' },
      };

      const response = await waitForDelegationResponse({
        piEventsBus: pi.events,
        request,
      });

      assertDelegationResponse(response);
      const result = await readVerifierResult({ paths, specId });

      return {
        content: [{ type: 'text', text: formatVerifierResult(result) }],
        details: result,
      };
    },
  });
};
