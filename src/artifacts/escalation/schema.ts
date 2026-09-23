/**
 * Objective: Define escalation options and resolution contracts.
 * Used: When Maestro handles escalation artifacts.
 */

import { type Static, Type } from 'typebox';
import { SPEC_ID_PATTERN } from '#ids.ts';

export const ESCALATION_VERSION = '1.0.0';

const ESCALATION_ID_PATTERN = /^E([1-9]\d*)$/;

export const EscalationOptionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    description: Type.String({ minLength: 1 }),
    consequences: Type.String({ minLength: 1 }),
    nextStep: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const EscalationRecommendationSchema = Type.Object(
  {
    optionId: Type.String({ minLength: 1 }),
    reason: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const EscalationResolutionSchema = Type.Object(
  {
    selectedOptionId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    decision: Type.String({ minLength: 1 }),
    reason: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const EscalationSchema = Type.Object(
  {
    version: Type.Literal(ESCALATION_VERSION),
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    revision: Type.Integer({ minimum: 1 }),
    id: Type.String({ pattern: ESCALATION_ID_PATTERN.source }),
    question: Type.String({ minLength: 1 }),
    context: Type.String({ minLength: 1 }),
    options: Type.Array(EscalationOptionSchema, { minItems: 1 }),
    recommendation: Type.Union([EscalationRecommendationSchema, Type.Null()]),
    resolution: Type.Union([EscalationResolutionSchema, Type.Null()]),
    notes: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export type EscalationOption = Static<typeof EscalationOptionSchema>;
export type EscalationResolution = Static<typeof EscalationResolutionSchema>;
export type Escalation = Static<typeof EscalationSchema>;
export type NewEscalation = Omit<
  Escalation,
  'version' | 'specId' | 'revision' | 'id' | 'resolution'
>;
