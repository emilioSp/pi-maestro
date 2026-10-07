/**
 * Objective: Check builder handoff content and spec ID.
 * Used: When Maestro handles builder handoff artifacts.
 */

import { Value } from 'typebox/value';
import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderAcceptanceCriterion,
  type BuilderHandoff,
  BuilderHandoffSchema,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';

const hasUniqueAcceptanceCriterionIds = (
  acceptanceCriteria: BuilderAcceptanceCriterion[],
): boolean =>
  new Set(acceptanceCriteria.map((criterion) => criterion.id)).size ===
  acceptanceCriteria.length;

const hasOnlyPassedProbes = (
  acceptanceCriteria: BuilderAcceptanceCriterion[],
): boolean =>
  acceptanceCriteria.every(
    (criterion) => criterion.probeStatus === PROBE_STATUSES.PASSED,
  );

const hasValidFailedChecks = (
  acceptanceCriteria: BuilderAcceptanceCriterion[],
): boolean =>
  acceptanceCriteria.length === 0 || !hasOnlyPassedProbes(acceptanceCriteria);

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

type AssertBuilderHandoffInput<Handoff = unknown> = {
  handoff: Handoff;
  specId: string;
};

export function assertBuilderHandoff(
  input: AssertBuilderHandoffInput,
): asserts input is AssertBuilderHandoffInput<BuilderHandoff> {
  assertBuilderHandoffSchema(input.handoff);
  const { handoff, specId } = input;

  if (!isValidSpecId(handoff.specId)) {
    throw new Error(`Invalid builder handoff spec ID: "${handoff.specId}".`);
  }

  if (!hasUniqueAcceptanceCriterionIds(handoff.acceptanceCriteria)) {
    throw new Error('Builder handoff acceptance criterion IDs must be unique.');
  }

  if (
    handoff.status === BUILDER_HANDOFF_STATUSES.DONE &&
    !hasOnlyPassedProbes(handoff.acceptanceCriteria)
  ) {
    throw new Error('Done builder handoff requires every probe to pass.');
  }

  if (
    handoff.status === BUILDER_HANDOFF_STATUSES.FAILED &&
    !hasValidFailedChecks(handoff.acceptanceCriteria)
  ) {
    throw new Error(
      'Failed builder handoff cannot mark every acceptance check as completed.',
    );
  }

  if (!isValidSpecId(specId)) {
    throw new Error(`Invalid expected builder handoff spec ID: "${specId}".`);
  }

  if (handoff.specId !== specId) {
    throw new Error(
      `Builder handoff spec ID mismatch: expected "${specId}", found "${handoff.specId}".`,
    );
  }
}
