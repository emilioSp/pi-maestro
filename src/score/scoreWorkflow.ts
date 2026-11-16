/**
 * Objective: Evaluate one completed implementation and persist its outcome before completion.
 * Used: Only by the scoring tool while the active workflow is in scorer-running.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { collectWorkflowEvidence } from '#src/score/collectWorkflowEvidence.ts';
import { parseClassifierScores } from '#src/score/parseClassifierScores.ts';
import { CLASSIFIER, requestEvaluation } from '#src/score/requestEvaluation.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

const SCORING_CRITERIA_VERSION = '1.0.0';

const EVALUATION_STATUS = { SUCCESS: 'success', FAILURE: 'failure' } as const;

const failure = (error: unknown) => ({
  status: EVALUATION_STATUS.FAILURE,
  reason: error instanceof Error ? error.message : String(error),
});

type EvaluationOutcome =
  | { status: typeof EVALUATION_STATUS.SUCCESS; scores: ReturnType<typeof parseClassifierScores> }
  | ReturnType<typeof failure>;

type ScoreWorkflowInput = {
  pi: ExtensionAPI;
  context: ExtensionContext;
  specId: string;
  signal?: AbortSignal;
};

export const scoreWorkflow = async ({ pi, context, specId, signal }: ScoreWorkflowInput) => {
  const { paths, config } = await resolveToolRunContext(context.cwd);
  const workflowPath = paths.getWorkflowPath(specId);
  const state = await readWorkflowState(workflowPath);

  if (maestroSessionState.getActiveSpecId() !== specId || state.specId !== specId) {
    throw new Error('Scoring requires the active workflow spec.');
  }

  if (state.phase !== WORKFLOW_PHASES.SCORER_RUNNING) {
    throw new Error(`Scoring requires scorer-running state, found "${state.phase}".`);
  }

  let outcome: EvaluationOutcome;
  const scoreDirectory = join(paths.getSpecPath(specId), 'spec-score');
  const reportPath = join(scoreDirectory, 'evaluation.json');
  const rawPath = join(scoreDirectory, 'evaluation.raw.json');

  await mkdir(scoreDirectory, { recursive: true });
  await rm(reportPath, { force: true });
  await rm(rawPath, { force: true });

  try {
    const evidence = await collectWorkflowEvidence({ pi, paths, specId, signal });
    const raw = await requestEvaluation({ evidence, context, signal });
    await writeFile(rawPath, `${JSON.stringify(raw, null, 2)}\n`);

    outcome = { status: EVALUATION_STATUS.SUCCESS, scores: parseClassifierScores(raw) };
  } catch (error) {
    outcome = failure(error);
  }

  const report = {
    specId,
    ...CLASSIFIER,
    scoringCriteriaVersion: SCORING_CRITERIA_VERSION,
    ...outcome,
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const nextState = transitionWorkflow({ config, state, event: WORKFLOW_EVENTS.SCORER_DONE });

  await writeWorkflowState({ path: workflowPath, state: nextState });

  return {
    specId,
    phase: nextState.phase,
    evaluation: report,
    reportPath,
    rawPath: outcome.status === EVALUATION_STATUS.SUCCESS ? rawPath : undefined,
  };
};
