/**
 * Objective: Define the builder handoff contract.
 * Used: When Maestro handles builder handoff artifacts.
 */

import { type Static, Type } from 'typebox';
import { SPEC_ID_PATTERN } from '#ids.ts';

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
