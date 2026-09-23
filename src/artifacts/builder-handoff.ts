/**
 * Objective: Validate and persist builder terminal handoffs.
 * Used: When a builder reports its completed or failed work.
 * Entrypoint: writeBuilderHandoff().
 */

import { type Static, Type } from 'typebox';
import { Value } from 'typebox/value';
import { writeJsonAtomically } from '#atomic-write.ts';
import { isValidSpecId, SPEC_ID_PATTERN } from '#ids.ts';
import { readJsonFile } from '#utils/read-json.ts';

export const BUILDER_HANDOFF_VERSION = '1.0.0';

export const BUILDER_HANDOFF_STATUSES = {
  DONE: 'done',
  FAILED: 'failed',
} as const;

export type BuilderHandoffStatus =
  (typeof BUILDER_HANDOFF_STATUSES)[keyof typeof BUILDER_HANDOFF_STATUSES];

export const PROBE_STATUSES = {
  PASSED: 'passed',
  FAILED: 'failed',
  NOT_RUN: 'not-run',
} as const;

export const BREAKAGE_STATUSES = {
  CONFIRMED: 'confirmed',
  NOT_CONFIRMED: 'not-confirmed',
  NOT_RUN: 'not-run',
} as const;

export type ProbeStatus = (typeof PROBE_STATUSES)[keyof typeof PROBE_STATUSES];
export type BreakageStatus =
  (typeof BREAKAGE_STATUSES)[keyof typeof BREAKAGE_STATUSES];

const ProbeStatusSchema = Type.Union([
  Type.Literal(PROBE_STATUSES.PASSED),
  Type.Literal(PROBE_STATUSES.FAILED),
  Type.Literal(PROBE_STATUSES.NOT_RUN),
]);

const BreakageStatusSchema = Type.Union([
  Type.Literal(BREAKAGE_STATUSES.CONFIRMED),
  Type.Literal(BREAKAGE_STATUSES.NOT_CONFIRMED),
  Type.Literal(BREAKAGE_STATUSES.NOT_RUN),
]);

export const BuilderAcceptanceCriterionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    probe: Type.String({ minLength: 1 }),
    probeStatus: ProbeStatusSchema,
    breakageStatus: BreakageStatusSchema,
  },
  { additionalProperties: false },
);

const BuilderHandoffFields = {
  version: Type.Literal(BUILDER_HANDOFF_VERSION),
  specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
  revision: Type.Integer({ minimum: 1 }),
  summary: Type.String({ minLength: 1 }),
  acceptanceCriteria: Type.Array(BuilderAcceptanceCriterionSchema),
  notes: Type.Array(Type.String()),
};

export const BuilderDoneHandoffSchema = Type.Object(
  {
    ...BuilderHandoffFields,
    status: Type.Literal(BUILDER_HANDOFF_STATUSES.DONE),
  },
  { additionalProperties: false },
);

export const BuilderFailedHandoffSchema = Type.Object(
  {
    ...BuilderHandoffFields,
    status: Type.Literal(BUILDER_HANDOFF_STATUSES.FAILED),
    failure: Type.Object(
      { reason: Type.String({ minLength: 1 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const BuilderHandoffSchema = Type.Union([
  BuilderDoneHandoffSchema,
  BuilderFailedHandoffSchema,
]);

export type BuilderAcceptanceCriterion = Static<
  typeof BuilderAcceptanceCriterionSchema
>;
export type BuilderHandoff = Static<typeof BuilderHandoffSchema>;

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

export const assertBuilderHandoffForWorkflow = ({
  handoff,
  specId,
  revision,
}: {
  handoff: BuilderHandoff;
  specId: string;
  revision: number;
}): void => {
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
};

export const readBuilderHandoff = async ({
  path,
  specId,
  revision,
}: {
  path: string;
  specId: string;
  revision: number;
}): Promise<BuilderHandoff> => {
  const handoff = await readJsonFile({ path, description: 'Builder handoff' });
  assertBuilderHandoff(handoff);
  assertBuilderHandoffForWorkflow({ handoff, specId, revision });
  return handoff;
};

export const writeBuilderHandoff = async ({
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
  assertBuilderHandoff(handoff);
  assertBuilderHandoffForWorkflow({ handoff, specId, revision });
  await writeJsonAtomically({ path, data: handoff });
};
