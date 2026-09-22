/**
 * Objective: Validate and persist verifier handoffs and findings.
 * Used: When a verifier reports its review result.
 * Entrypoint: writeVerifierHandoff().
 */

import { type Static, Type } from 'typebox';
import { Value } from 'typebox/value';
import {
  BREAKAGE_STATUSES,
  type BuilderAcceptanceCriterion,
  BuilderAcceptanceCriterionSchema,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff.ts';
import { writeJsonAtomically } from '#atomic-write.ts';
import { isValidSpecId, SPEC_ID_PATTERN } from '#ids.ts';
import { readJsonFile } from '#utils/read-json.ts';

export const VERIFIER_HANDOFF_VERSION = '1.0.0';

export const FINDING_SEVERITIES = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

const FindingSeveritySchema = Type.Union([
  Type.Literal(FINDING_SEVERITIES.HIGH),
  Type.Literal(FINDING_SEVERITIES.MEDIUM),
  Type.Literal(FINDING_SEVERITIES.LOW),
]);

const FindingEvidenceSchema = Type.Object(
  {
    source: Type.String({ minLength: 1 }),
    observation: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const FindingRejectionSchema = Type.Object(
  { reason: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);

export const VerifierFindingSchema = Type.Object(
  {
    id: Type.String({ pattern: '^F[1-9]\\d*$' }),
    acceptanceCriterion: Type.Union([
      Type.String({ minLength: 1 }),
      Type.Null(),
    ]),
    severity: FindingSeveritySchema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    summary: Type.String({ minLength: 1 }),
    evidence: Type.Array(FindingEvidenceSchema, { minItems: 1 }),
    rejection: Type.Union([FindingRejectionSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const VerifierHandoffSchema = Type.Object(
  {
    version: Type.Literal(VERIFIER_HANDOFF_VERSION),
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    revision: Type.Integer({ minimum: 1 }),
    summary: Type.String({ minLength: 1 }),
    acceptanceCriteria: Type.Array(BuilderAcceptanceCriterionSchema),
    findings: Type.Array(VerifierFindingSchema),
    notes: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export type VerifierFinding = Static<typeof VerifierFindingSchema>;
export type VerifierHandoff = Static<typeof VerifierHandoffSchema>;

const hasCompletedChecks = (criterion: BuilderAcceptanceCriterion): boolean =>
  criterion.probeStatus === PROBE_STATUSES.PASSED &&
  criterion.breakageStatus === BREAKAGE_STATUSES.CONFIRMED;

export const validateVerifierHandoff = (input: unknown): VerifierHandoff => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Verifier handoff must be a JSON object.');
  }

  const [error] = Value.Errors(VerifierHandoffSchema, input);
  if (error !== undefined) {
    throw new Error(`Invalid verifier handoff: ${error.message}.`);
  }

  const handoff = input as VerifierHandoff;
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
  return handoff;
};

export const validateVerifierHandoffForWorkflow = ({
  handoff,
  specId,
  revision,
}: {
  handoff: unknown;
  specId: string;
  revision: number;
}): VerifierHandoff => {
  const validatedHandoff = validateVerifierHandoff(handoff);
  if (validatedHandoff.specId !== specId) {
    throw new Error(
      `Verifier handoff spec ID mismatch: expected "${specId}", found "${validatedHandoff.specId}".`,
    );
  }
  if (validatedHandoff.revision !== revision) {
    throw new Error(
      `Verifier handoff revision mismatch: expected ${revision}, found ${validatedHandoff.revision}.`,
    );
  }

  return validatedHandoff;
};

export const readVerifierHandoff = async ({
  path,
  specId,
  revision,
}: {
  path: string;
  specId: string;
  revision: number;
}): Promise<VerifierHandoff> =>
  validateVerifierHandoffForWorkflow({
    handoff: await readJsonFile({ path, description: 'Verifier handoff' }),
    specId,
    revision,
  });

export const writeVerifierHandoff = async ({
  path,
  handoff,
  specId,
  revision,
}: {
  path: string;
  handoff: unknown;
  specId: string;
  revision: number;
}): Promise<void> => {
  const validatedHandoff = validateVerifierHandoffForWorkflow({
    handoff,
    specId,
    revision,
  });
  if (validatedHandoff.findings.some((finding) => finding.rejection !== null)) {
    throw new Error('New verifier handoff findings must have no rejection.');
  }

  await writeJsonAtomically({ path, data: validatedHandoff });
};

export const rejectVerifierFinding = async ({
  path,
  specId,
  revision,
  findingId,
  reason,
}: {
  path: string;
  specId: string;
  revision: number;
  findingId: string;
  reason: string;
}): Promise<VerifierHandoff> => {
  const handoff = await readVerifierHandoff({ path, specId, revision });
  const finding = handoff.findings.find(({ id }) => id === findingId);
  if (finding === undefined) {
    throw new Error(`Verifier finding "${findingId}" does not exist.`);
  }
  if (finding.rejection !== null) {
    throw new Error(`Verifier finding "${findingId}" is already rejected.`);
  }
  if (reason.length === 0) {
    throw new Error('Verifier finding rejection reason must be non-empty.');
  }

  const rejectedHandoff = validateVerifierHandoff({
    ...handoff,
    findings: handoff.findings.map((currentFinding) =>
      currentFinding.id === findingId
        ? { ...currentFinding, rejection: { reason } }
        : currentFinding,
    ),
  });
  await writeJsonAtomically({ path, data: rejectedHandoff });

  return rejectedHandoff;
};
