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
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import {
  assertDelegationResponse,
  waitForDelegationResponse,
} from '#tools/utils/pi-subagent-delegation.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';
import {
  prepareVerifierRun,
  type VerifierRun,
} from '#workflow/verifier/prepareVerifierRun.ts';

export const RUN_VERIFIER_TOOL = {
  NAME: 'maestro_run_verifier',
  LABEL: 'Run Verifier',
  DESCRIPTION:
    'Run the verifier in the current checkout for a completed builder candidate. The verifier runs in the foreground.',
} as const;

const RunVerifierToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
  },
  { additionalProperties: false },
);

const MILLISECONDS_PER_MINUTE = 60_000;

type CandidateReadyResult = {
  outcome: typeof WORKFLOW_PHASES.CANDIDATE_READY;
  specId: string;
  revision: number;
  phase: typeof WORKFLOW_PHASES.CANDIDATE_READY;
  candidateCommit: string;
  checkpointCommit: string;
  handoff: VerifierHandoff;
};

type FindingsResult = {
  outcome: typeof WORKFLOW_PHASES.FINDINGS_DECISION;
  specId: string;
  revision: number;
  phase: typeof WORKFLOW_PHASES.FINDINGS_DECISION;
  candidateCommit: string;
  checkpointCommit: string;
  handoff: VerifierHandoff;
};

type VerifierRunResult = CandidateReadyResult | FindingsResult;

type ReadTerminalVerifierResultInput = {
  paths: MaestroPaths;
  specId: string;
  run: VerifierRun;
  state: WorkflowState;
};

const readTerminalVerifierResult = async ({
  paths,
  specId,
  run,
  state,
}: ReadTerminalVerifierResultInput): Promise<
  CandidateReadyResult | FindingsResult
> => {
  if (
    state.phase !== WORKFLOW_PHASES.CANDIDATE_READY &&
    state.phase !== WORKFLOW_PHASES.FINDINGS_DECISION
  ) {
    throw new Error(
      `Verifier returned with unexpected workflow phase "${state.phase}".`,
    );
  }

  const repositoryStatus = await getRepositoryStatus(run.repositoryRoot);

  if (!repositoryStatus.clean) {
    throw new Error(
      'The verifier returned without committing its final handoff.',
    );
  }

  const handoff = await readVerifierHandoff({
    path: paths.getVerifierHandoffPath(specId),
    specId,
    revision: state.revision,
  });

  const expectedPhase =
    handoff.findings.length > 0
      ? WORKFLOW_PHASES.FINDINGS_DECISION
      : WORKFLOW_PHASES.CANDIDATE_READY;

  if (state.phase !== expectedPhase) {
    throw new Error(
      `Verifier handoff findings do not match workflow phase "${state.phase}".`,
    );
  }

  const details = {
    specId,
    revision: state.revision,
    candidateCommit: run.candidateCommit,
    checkpointCommit: run.checkpointCommit,
    handoff,
  };

  if (state.phase === WORKFLOW_PHASES.CANDIDATE_READY) {
    return { ...details, outcome: state.phase, phase: state.phase };
  }

  return { ...details, outcome: state.phase, phase: state.phase };
};

type ReadVerifierResultInput = {
  paths: MaestroPaths;
  specId: string;
  run: VerifierRun;
};

const readVerifierResult = async ({
  paths,
  specId,
  run,
}: ReadVerifierResultInput): Promise<VerifierRunResult> => {
  try {
    const state = await readWorkflowState(paths.getWorkflowPath(specId));

    if (state.specId !== specId) {
      throw new Error(
        `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
      );
    }

    if (state.phase === WORKFLOW_PHASES.VERIFIER_RUNNING) {
      throw new Error(
        'The verifier returned without recording a valid terminal handoff.',
      );
    }

    return await readTerminalVerifierResult({
      paths,
      specId,
      run,
      state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Verifier protocol error: ${message}.`, { cause: error });
  }
};

const formatVerifierResult = (result: VerifierRunResult): string => {
  if (result.outcome === WORKFLOW_PHASES.CANDIDATE_READY) {
    return `Verifier completed spec ${result.specId}. The workflow is candidate-ready.`;
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

      const request: SubagentDelegationRequest = {
        requestId: randomUUID(),
        ownerRunId: toolCallId,
        nodeId: WORKFLOW_ROLES.VERIFIER,
        // pi-subagents loads this name from agents/verifier.md through package.json.
        agent: AGENTS.VERIFIER,
        task: `Verify specId "${specId}" at candidate checkpoint "${run.candidateCommit}" in the current checkout "${run.repositoryRoot}". Read all applicable AGENTS.md files before working.`,
        context: 'fresh',
        cwd: run.repositoryRoot,
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
      const result = await readVerifierResult({ paths, specId, run });

      return {
        content: [{ type: 'text', text: formatVerifierResult(result) }],
        details: result,
      };
    },
  });
};
