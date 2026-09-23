/**
 * Objective: Define the verifier handoff and finding contracts.
 * Used: When Maestro handles verifier handoff artifacts.
 */

import { type Static, Type } from 'typebox';
import { BuilderAcceptanceCriterionSchema } from '#artifacts/builder-handoff/schema.ts';
import { SPEC_ID_PATTERN } from '#ids.ts';

export const VERIFIER_HANDOFF_VERSION = '1.0.0';

export const FINDING_SEVERITIES = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type FindingSeverity =
  (typeof FINDING_SEVERITIES)[keyof typeof FINDING_SEVERITIES];

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
