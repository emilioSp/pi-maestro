/**
 * Objective: Validate both classifier dimensions and normalize them without changing confidence.
 * Used: When a classifier response is returned for workflow evaluation.
 */

import type { ClassifierResult } from '@earendil-works/pi-ai';

import questions from '#src/score/questions.json' with { type: 'json' };

const SCORE_DIMENSIONS = {
  CORRECTNESS: 'correctness',
  VERIFICATION_QUALITY: 'verificationQuality',
} as const;

type ParseScoreInput = {
  result: ClassifierResult;
  dimension: (typeof SCORE_DIMENSIONS)[keyof typeof SCORE_DIMENSIONS];
};

const parseScore = ({ result, dimension }: ParseScoreInput) => {
  const answer = result.answers?.[dimension];
  const maxScore = questions[dimension].criteria.length - 1;

  if (answer?.type !== 'score') {
    throw new Error(`Invalid ${dimension} answer: expected score type.`);
  }

  if (!Number.isFinite(answer.score) || answer.score < 0 || answer.score > maxScore) {
    throw new Error(`Invalid ${dimension} score: expected a finite value from 0 to ${maxScore}.`);
  }

  if (!Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) {
    throw new Error(`Invalid ${dimension} confidence: expected a finite value from 0 to 1.`);
  }

  return {
    score: answer.score * (100 / maxScore),
    confidence: answer.confidence,
  };
};

export const parseClassifierScores = (result: ClassifierResult) => {
  if (result.stopReason !== 'stop') {
    throw new Error(result.errorMessage || `Classifier stopped with ${result.stopReason}.`);
  }

  return {
    correctness: parseScore({ result, dimension: SCORE_DIMENSIONS.CORRECTNESS }),
    verificationQuality: parseScore({ result, dimension: SCORE_DIMENSIONS.VERIFICATION_QUALITY }),
  };
};
