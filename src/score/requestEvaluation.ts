/**
 * Objective: Request an evaluation of supplied workflow evidence from the fixed classifier.
 * Used: By workflow scoring before normalizing and persisting the evaluation outcome.
 */

import { readFile } from 'node:fs/promises';

import type { ClassifierScoreQuestion } from '@earendil-works/pi-ai';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import type { WorkflowEvidence } from '#src/score/collectWorkflowEvidence.ts';

export const CLASSIFIER = { provider: 'openrouter', model: 'typesafe/jev-1.14' } as const;

export class EvaluationCancelledError extends Error {
  constructor() {
    super('Workflow scoring cancelled.');
  }
}

type RequestEvaluationInput = {
  evidence: WorkflowEvidence;
  context: ExtensionContext;
  signal?: AbortSignal;
};

export const requestEvaluation = async ({ evidence, context, signal }: RequestEvaluationInput) => {
  const questions: Record<string, ClassifierScoreQuestion> = JSON.parse(
    await readFile(new URL('./questions.json', import.meta.url), 'utf8'),
  );

  const model = context.modelRegistry.getModelOfType(
    'classifier',
    CLASSIFIER.provider,
    CLASSIFIER.model,
  );

  if (!model) throw new Error('Exact classifier openrouter/typesafe/jev-1.14 unavailable.');

  const raw = await context.modelRegistry.classify(
    model,
    { state: evidence, questions },
    { signal, maxRetries: 0 },
  );

  if (raw.stopReason === 'aborted') throw new EvaluationCancelledError();

  return raw;
};
