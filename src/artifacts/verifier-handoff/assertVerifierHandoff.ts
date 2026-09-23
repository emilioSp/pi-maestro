/**
 * Objective: Check verifier handoff content, spec ID, and revision.
 * Used: When Maestro handles verifier handoff artifacts.
 * Entrypoint: assertVerifierHandoff().
 */

import { Value } from 'typebox/value';
import {
  BREAKAGE_STATUSES,
  type BuilderAcceptanceCriterion,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import {
  type VerifierHandoff,
  VerifierHandoffSchema,
} from '#artifacts/verifier-handoff/schema.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';

const hasCompletedChecks = (criterion: BuilderAcceptanceCriterion): boolean =>
  criterion.probeStatus === PROBE_STATUSES.PASSED &&
  criterion.breakageStatus === BREAKAGE_STATUSES.CONFIRMED;

function assertVerifierHandoffSchema(
  input: unknown,
): asserts input is VerifierHandoff {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Verifier handoff must be a JSON object.');
  }

  const [error] = Value.Errors(VerifierHandoffSchema, input);
  if (error !== undefined) {
    throw new Error(`Invalid verifier handoff: ${error.message}.`);
  }
}

export function assertVerifierHandoff(
  handoff: unknown,
  specId: string,
  revision: number,
): asserts handoff is VerifierHandoff {
  assertVerifierHandoffSchema(handoff);
  if (!isValidSpecId(handoff.specId)) {
    throw new Error(`Invalid verifier handoff spec ID: "${handoff.specId}".`);
  }
  if (
    new Set(handoff.acceptanceCriteria.map((criterion) => criterion.id))
      .size !== handoff.acceptanceCriteria.length
  ) {
    throw new Error(
      'Verifier handoff acceptance criterion IDs must be unique.',
    );
  }

  const acceptanceCriterionIds = new Set(
    handoff.acceptanceCriteria.map((criterion) => criterion.id),
  );
  for (const [index, finding] of handoff.findings.entries()) {
    const expectedId = `F${index + 1}`;
    if (finding.id !== expectedId) {
      throw new Error(
        `Verifier handoff finding IDs must be sequential: expected "${expectedId}", found "${finding.id}".`,
      );
    }
    if (
      finding.acceptanceCriterion !== null &&
      !acceptanceCriterionIds.has(finding.acceptanceCriterion)
    ) {
      throw new Error(
        `Verifier handoff finding "${finding.id}" references unknown acceptance criterion "${finding.acceptanceCriterion}".`,
      );
    }
  }

  const findingCriteria = new Set(
    handoff.findings.flatMap((finding) =>
      finding.acceptanceCriterion === null ? [] : [finding.acceptanceCriterion],
    ),
  );
  for (const criterion of handoff.acceptanceCriteria) {
    if (!hasCompletedChecks(criterion) && !findingCriteria.has(criterion.id)) {
      throw new Error(
        `Verifier handoff incomplete acceptance criterion "${criterion.id}" requires a finding.`,
      );
    }
  }
  if (handoff.specId !== specId) {
    throw new Error(
      `Verifier handoff spec ID mismatch: expected "${specId}", found "${handoff.specId}".`,
    );
  }
  if (handoff.revision !== revision) {
    throw new Error(
      `Verifier handoff revision mismatch: expected ${revision}, found ${handoff.revision}.`,
    );
  }
}
