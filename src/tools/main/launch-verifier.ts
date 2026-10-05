/**
 * Objective: Launch and validate one foreground verifier pass for the owner session.
 * Used: When the owner invokes the launch-verifier tool.
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
import { resolveToolLaunchContext } from '#tools/utils/resolveToolLaunchContext.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import {
  VERIFIER_PASS_ERRORS,
  VERIFIER_PASS_MESSAGES,
} from '#workflow/verifier/completeVerifierPass.ts';
import { hasProductChanges } from '#workflow/verifier/hasProductChanges.ts';
import {
  prepareVerifierLaunch,
  type VerifierLaunch,
} from '#workflow/verifier/prepareVerifierLaunch.ts';

export const LAUNCH_VERIFIER_TOOL = {
  NAME: 'maestro_launch_verifier',
  LABEL: 'Launch Verifier',
  DESCRIPTION:
    'Launch the verifier in the current checkout for a completed builder candidate. The verifier runs in the foreground.',
} as const;

const LaunchVerifierToolParameters = Type.Object(
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

type ProductChangesResult = {
  outcome: typeof VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED;
  error: typeof VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED;
  message: typeof VERIFIER_PASS_MESSAGES.PRODUCT_FILES_MODIFIED;
  specId: string;
  revision: number;
  phase: typeof WORKFLOW_PHASES.VERIFIER_RUNNING;
  candidateCommit: string;
  checkpointCommit: string;
};

type VerifierLaunchResult =
  | CandidateReadyResult
  | FindingsResult
  | ProductChangesResult;

type ReadVerifierResultInput = {
  paths: MaestroPaths;
  specId: string;
  launch: VerifierLaunch;
};

const readVerifierResult = async ({
  paths,
  specId,
  launch,
}: ReadVerifierResultInput): Promise<VerifierLaunchResult> => {
  try {
    const state = await readWorkflowState({
      path: paths.getWorkflowPath(specId),
    });

    if (state.specId !== specId) {
      throw new Error(
        `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
      );
    }

    const productChanges = await hasProductChanges({
      repositoryRoot: launch.repositoryRoot,
      candidateCommit: launch.candidateCommit,
      workflowPath: paths.getWorkflowPath(specId),
      handoffPath: paths.getVerifierHandoffPath(specId),
    });

    if (state.phase === WORKFLOW_PHASES.VERIFIER_RUNNING) {
      if (productChanges) {
        return {
          outcome: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
          error: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
          message: VERIFIER_PASS_MESSAGES.PRODUCT_FILES_MODIFIED,
          specId,
          revision: state.revision,
          phase: state.phase,
          candidateCommit: launch.candidateCommit,
          checkpointCommit: launch.checkpointCommit,
        };
      }

      throw new Error(
        'The verifier returned without recording a valid terminal handoff.',
      );
    }

    if (
      state.phase !== WORKFLOW_PHASES.CANDIDATE_READY &&
      state.phase !== WORKFLOW_PHASES.FINDINGS_DECISION
    ) {
      throw new Error(
        `Verifier returned with unexpected workflow phase "${state.phase}".`,
      );
    }

    if (productChanges) {
      throw new Error(
        'Product files differ from the candidate after the verifier handoff.',
      );
    }

    const repositoryStatus = await getRepositoryStatus({
      repositoryRoot: launch.repositoryRoot,
    });

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

    if (state.phase === WORKFLOW_PHASES.CANDIDATE_READY) {
      return {
        outcome: state.phase,
        specId,
        revision: state.revision,
        phase: state.phase,
        candidateCommit: launch.candidateCommit,
        checkpointCommit: launch.checkpointCommit,
        handoff,
      };
    }

    return {
      outcome: state.phase,
      specId,
      revision: state.revision,
      phase: state.phase,
      candidateCommit: launch.candidateCommit,
      checkpointCommit: launch.checkpointCommit,
      handoff,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Verifier protocol error: ${message}.`, { cause: error });
  }
};

const formatVerifierResult = ({
  result,
}: {
  result: VerifierLaunchResult;
}): string => {
  if (result.outcome === WORKFLOW_PHASES.CANDIDATE_READY) {
    return `Verifier completed spec ${result.specId}. The workflow is candidate-ready.`;
  }

  if (result.outcome === WORKFLOW_PHASES.FINDINGS_DECISION) {
    return `Verifier found ${result.handoff.findings.length} finding(s) for spec ${result.specId}. The workflow is waiting for owner decisions.`;
  }

  return `${result.message} The workflow remains verifier-running.`;
};

export const registerLaunchVerifierTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: LAUNCH_VERIFIER_TOOL.NAME,
    label: LAUNCH_VERIFIER_TOOL.LABEL,
    description: LAUNCH_VERIFIER_TOOL.DESCRIPTION,
    parameters: LaunchVerifierToolParameters,
    async execute(toolCallId, { specId }, _signal, _onUpdate, context) {
      const { paths, config } = await resolveToolLaunchContext({
        cwd: context.cwd,
      });

      const launch = await prepareVerifierLaunch({ paths, specId });

      const request: SubagentDelegationRequest = {
        requestId: randomUUID(),
        ownerRunId: toolCallId,
        nodeId: WORKFLOW_ROLES.VERIFIER,
        // pi-subagents loads this name from agents/verifier.md through package.json.
        agent: AGENTS.VERIFIER,
        task: `Verify specId "${specId}" in the current checkout "${launch.repositoryRoot}". Read all applicable AGENTS.md files before working.`,
        context: 'fresh',
        cwd: launch.repositoryRoot,
        model: config.verifier.model,
        thinking: config.verifier.thinking,
        timeoutMs: config.verifier.timeoutMinutes * MILLISECONDS_PER_MINUTE,
        result: { kind: 'text' },
      };

      const response = await waitForDelegationResponse({
        piEventsBus: pi.events,
        request,
      });

      assertDelegationResponse({ response });
      const result = await readVerifierResult({ paths, specId, launch });

      return {
        content: [{ type: 'text', text: formatVerifierResult({ result }) }],
        details: result,
      };
    },
  });
};
