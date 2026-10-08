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
  ESCALATION: 'escalation',
} as const;

export type BuilderHandoffStatus =
  (typeof BUILDER_HANDOFF_STATUSES)[keyof typeof BUILDER_HANDOFF_STATUSES];

export const PROBE_STATUSES = {
  PASSED: 'passed',
  FAILED: 'failed',
  NOT_RUN: 'not-run',
} as const;

export type ProbeStatus = (typeof PROBE_STATUSES)[keyof typeof PROBE_STATUSES];

const ProbeStatusSchema = StringEnum(Object.values(PROBE_STATUSES));

export const BuilderAcceptanceCriterionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    probe: Type.String({ minLength: 1 }),
    probeStatus: ProbeStatusSchema,
  },
  { additionalProperties: false },
);

export type BuilderAcceptanceCriterion = Static<
  typeof BuilderAcceptanceCriterionSchema
>;

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

  ...BuilderHandoffContentFields,
};

export const ESCALATION_ID_PATTERN = /^E([1-9]\d*)$/;

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
    decision: Type.String({ minLength: 1, pattern: '\\S' }),
    reason: Type.String({ minLength: 1, pattern: '\\S' }),
  },
  { additionalProperties: false },
);

const EscalationContentFields = {
  question: Type.String({ minLength: 1 }),
  context: Type.String({ minLength: 1 }),
  options: Type.Array(EscalationOptionSchema, { minItems: 1 }),
  notes: Type.Array(Type.String()),
};

export const EscalationSchema = Type.Object(
  {
    id: Type.String({ pattern: ESCALATION_ID_PATTERN.source }),
    ...EscalationContentFields,
    recommendation: Type.Union([EscalationRecommendationSchema, Type.Null()]),
    resolution: Type.Union([EscalationResolutionSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

const EscalationSubmissionSchema = Type.Object(
  { ...EscalationSchema.properties, resolution: Type.Null() },
  { additionalProperties: false },
);

export type EscalationOption = Static<typeof EscalationOptionSchema>;

export type EscalationResolution = Static<typeof EscalationResolutionSchema>;

export type Escalation = Static<typeof EscalationSchema>;

export const BuilderDoneHandoffSchema = Type.Object(
  {
    ...BuilderHandoffFields,
    status: Type.Literal(BUILDER_HANDOFF_STATUSES.DONE),
    escalations: Type.Array(EscalationSchema, { maxItems: 0 }),
  },
  { additionalProperties: false },
);

export const BuilderEscalationHandoffSchema = Type.Object(
  {
    ...BuilderHandoffFields,
    status: Type.Literal(BUILDER_HANDOFF_STATUSES.ESCALATION),
    escalations: Type.Array(EscalationSchema, { minItems: 1 }),
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
  BuilderEscalationHandoffSchema,
  BuilderFailedHandoffSchema,
]);

export type BuilderHandoff = Static<typeof BuilderHandoffSchema>;

export const BuilderDoneHandoffSubmissionSchema = Type.Object(
  {
    status: Type.Literal(BUILDER_HANDOFF_STATUSES.DONE),
    ...BuilderHandoffContentFields,
    escalations: Type.Array(EscalationSchema, { maxItems: 0 }),
  },
  { additionalProperties: false },
);

export const BuilderEscalationHandoffSubmissionSchema = Type.Object(
  {
    status: Type.Literal(BUILDER_HANDOFF_STATUSES.ESCALATION),
    ...BuilderHandoffContentFields,
    escalations: Type.Array(EscalationSubmissionSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export const BuilderFailedHandoffSubmissionSchema = Type.Object(
  {
    status: Type.Literal(BUILDER_HANDOFF_STATUSES.FAILED),
    ...BuilderHandoffContentFields,
    failure: BuilderHandoffFailureSchema,
  },
  { additionalProperties: false },
);

export const BuilderHandoffSubmissionSchema = Type.Union([
  BuilderDoneHandoffSubmissionSchema,
  BuilderEscalationHandoffSubmissionSchema,
  BuilderFailedHandoffSubmissionSchema,
]);

export type BuilderHandoffSubmissionInput = Static<
  typeof BuilderHandoffSubmissionSchema
>;
