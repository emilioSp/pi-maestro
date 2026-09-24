/**
 * Objective: Define escalation options and resolution contracts.
 * Used: When Maestro handles escalation artifacts.
 */

import { type Static, Type } from 'typebox';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';

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

export const EscalationRecommendationSchema = Type.Object(
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

const NewEscalationFields = {
  question: Type.String({ minLength: 1 }),
  context: Type.String({ minLength: 1 }),
  options: Type.Array(EscalationOptionSchema, { minItems: 1 }),
  notes: Type.Array(Type.String()),
};

export const NewEscalationSchema = Type.Object(
  {
    ...NewEscalationFields,
    recommendation: Type.Union([EscalationRecommendationSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const EscalationSchema = Type.Object(
  {
    version: Type.Literal(ESCALATION_VERSION),
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    revision: Type.Integer({ minimum: 1 }),
    id: Type.String({ pattern: ESCALATION_ID_PATTERN.source }),
    ...NewEscalationFields,
    recommendation: Type.Union([EscalationRecommendationSchema, Type.Null()]),
    resolution: Type.Union([EscalationResolutionSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export type EscalationOption = Static<typeof EscalationOptionSchema>;
export type EscalationResolution = Static<typeof EscalationResolutionSchema>;
export type Escalation = Static<typeof EscalationSchema>;
export type NewEscalation = Static<typeof NewEscalationSchema>;
