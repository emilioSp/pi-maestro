/**
 * Objective: Define the builder handoff contract.
 * Used: When Maestro handles builder handoff artifacts.
 */

import { StringEnum } from '@earendil-works/pi-ai';
import { type Static, Type } from 'typebox';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';

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

const ProbeStatusSchema = StringEnum(Object.values(PROBE_STATUSES));

const BreakageStatusSchema = StringEnum(Object.values(BREAKAGE_STATUSES));

export const BuilderAcceptanceCriterionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    probe: Type.String({ minLength: 1 }),
    probeStatus: ProbeStatusSchema,
    breakageStatus: BreakageStatusSchema,
  },
  { additionalProperties: false },
);

export const BuilderHandoffFailureSchema = Type.Object(
  { reason: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);

const BuilderHandoffContentFields = {
  summary: Type.String({ minLength: 1 }),
  acceptanceCriteria: Type.Array(BuilderAcceptanceCriterionSchema),
  notes: Type.Array(Type.String()),
};

const BuilderHandoffFields = {
  version: Type.Literal(BUILDER_HANDOFF_VERSION),
  specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
  revision: Type.Integer({ minimum: 1 }),
  ...BuilderHandoffContentFields,
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
    failure: BuilderHandoffFailureSchema,
  },
  { additionalProperties: false },
);

export const BuilderHandoffSchema = Type.Union([
  BuilderDoneHandoffSchema,
  BuilderFailedHandoffSchema,
]);

export const BuilderHandoffSubmissionSchema = Type.Object(
  {
    status: StringEnum(Object.values(BUILDER_HANDOFF_STATUSES), {
      description:
        'Whether the builder completed the work or could not complete it.',
    }),
    ...BuilderHandoffContentFields,
    failure: Type.Optional(BuilderHandoffFailureSchema),
  },
  { additionalProperties: false },
);

export type BuilderAcceptanceCriterion = Static<
  typeof BuilderAcceptanceCriterionSchema
>;
export type BuilderHandoff = Static<typeof BuilderHandoffSchema>;
export type BuilderHandoffSubmissionInput = Static<
  typeof BuilderHandoffSubmissionSchema
>;
export type BuilderHandoffSubmission =
  | {
      status: typeof BUILDER_HANDOFF_STATUSES.DONE;
      summary: string;
      acceptanceCriteria: BuilderAcceptanceCriterion[];
      notes: string[];
    }
  | {
      status: typeof BUILDER_HANDOFF_STATUSES.FAILED;
      summary: string;
      acceptanceCriteria: BuilderAcceptanceCriterion[];
      failure: { reason: string };
      notes: string[];
    };
