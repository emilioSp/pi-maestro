/**
 * Objective: Check the builder handoff schema and evidence.
 * Used: When Maestro handles builder handoff artifacts.
 * Entrypoint: assertBuilderHandoff().
 */

import { Value } from 'typebox/value';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  type BuilderAcceptanceCriterion,
  type BuilderHandoff,
  BuilderHandoffSchema,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { isValidSpecId } from '#ids.ts';

const hasUniqueAcceptanceCriterionIds = (
  acceptanceCriteria: BuilderAcceptanceCriterion[],
): boolean =>
  new Set(acceptanceCriteria.map((criterion) => criterion.id)).size ===
  acceptanceCriteria.length;

const hasOnlyCompletedChecks = (
  acceptanceCriteria: BuilderAcceptanceCriterion[],
): boolean =>
  acceptanceCriteria.every(
    (criterion) =>
      criterion.probeStatus === PROBE_STATUSES.PASSED &&
      criterion.breakageStatus === BREAKAGE_STATUSES.CONFIRMED,
  );

const hasPartialCheck = (
  acceptanceCriteria: BuilderAcceptanceCriterion[],
): boolean => !hasOnlyCompletedChecks(acceptanceCriteria);

function assertBuilderHandoffSchema(
  input: unknown,
): asserts input is BuilderHandoff {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Builder handoff must be a JSON object.');
  }

  const [error] = Value.Errors(BuilderHandoffSchema, input);
  if (error !== undefined) {
    throw new Error(`Invalid builder handoff: ${error.message}.`);
  }
}

export function assertBuilderHandoff(
  input: unknown,
): asserts input is BuilderHandoff {
  assertBuilderHandoffSchema(input);
  const handoff = input;
  if (!isValidSpecId(handoff.specId)) {
    throw new Error(`Invalid builder handoff spec ID: "${handoff.specId}".`);
  }
  if (!hasUniqueAcceptanceCriterionIds(handoff.acceptanceCriteria)) {
    throw new Error('Builder handoff acceptance criterion IDs must be unique.');
  }
  if (
    handoff.status === BUILDER_HANDOFF_STATUSES.DONE &&
    !hasOnlyCompletedChecks(handoff.acceptanceCriteria)
  ) {
    throw new Error(
      'Done builder handoff requires every probe to pass and every breakage check to be confirmed.',
    );
  }
  if (
    handoff.status === BUILDER_HANDOFF_STATUSES.FAILED &&
    !hasPartialCheck(handoff.acceptanceCriteria)
  ) {
    throw new Error(
      'Failed builder handoff requires at least one failed, unconfirmed, or not-run check.',
    );
  }
}
