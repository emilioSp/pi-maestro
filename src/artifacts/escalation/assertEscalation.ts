/**
 * Objective: Check the escalation schema and option references.
 * Used: When Maestro handles escalation artifacts.
 */

import { Value } from 'typebox/value';
import {
  type Escalation,
  EscalationSchema,
} from '#artifacts/escalation/schema.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';

const hasOption = (escalation: Escalation, optionId: string): boolean =>
  escalation.options.some((option) => option.id === optionId);

function assertEscalationSchema(input: unknown): asserts input is Escalation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Escalation must be a JSON object.');
  }

  const [error] = Value.Errors(EscalationSchema, input);

  if (error !== undefined) {
    throw new Error(`Invalid escalation: ${error.message}.`);
  }
}

export function assertEscalation(input: unknown): asserts input is Escalation {
  assertEscalationSchema(input);
  const escalation = input;

  if (!isValidSpecId(escalation.specId)) {
    throw new Error(`Invalid escalation spec ID: "${escalation.specId}".`);
  }

  if (
    new Set(escalation.options.map((option) => option.id)).size !==
    escalation.options.length
  ) {
    throw new Error('Escalation option IDs must be unique.');
  }

  if (
    escalation.recommendation !== null &&
    !hasOption(escalation, escalation.recommendation.optionId)
  ) {
    throw new Error(
      `Escalation recommendation references unknown option "${escalation.recommendation.optionId}".`,
    );
  }

  if (
    escalation.resolution !== null &&
    escalation.resolution.selectedOptionId !== null &&
    !hasOption(escalation, escalation.resolution.selectedOptionId)
  ) {
    throw new Error(
      `Escalation resolution references unknown option "${escalation.resolution.selectedOptionId}".`,
    );
  }
}
