/**
 * Objective: Check builder handoff content, spec ID, and revision.
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
  handoff: unknown,
  specId: string,
  revision: number,
): asserts handoff is BuilderHandoff {
  assertBuilderHandoffSchema(handoff);
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
  if (!isValidSpecId(specId)) {
    throw new Error(`Invalid expected builder handoff spec ID: "${specId}".`);
  }
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error(
      'Expected builder handoff revision must be a positive integer.',
    );
  }
  if (handoff.specId !== specId) {
    throw new Error(
      `Builder handoff spec ID mismatch: expected "${specId}", found "${handoff.specId}".`,
    );
  }
  if (handoff.revision !== revision) {
    throw new Error(
      `Builder handoff revision mismatch: expected ${revision}, found ${handoff.revision}.`,
    );
  }
}
