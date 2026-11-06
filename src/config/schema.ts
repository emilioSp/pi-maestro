/**
 * Objective: Define the input and resolved configuration contracts.
 * Used: When configuration is validated or resolved.
 */

import { type Static, Type } from 'typebox';

export const THINKING_LEVELS = {
  OFF: 'off',
  MINIMAL: 'minimal',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  XHIGH: 'xhigh',
  MAX: 'max',
} as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[keyof typeof THINKING_LEVELS];

export const SUPPORTED_CONFIG_VERSION = '1.0.0';

export const ThinkingSchema = Type.Union([
  Type.Literal(THINKING_LEVELS.OFF),
  Type.Literal(THINKING_LEVELS.MINIMAL),
  Type.Literal(THINKING_LEVELS.LOW),
  Type.Literal(THINKING_LEVELS.MEDIUM),
  Type.Literal(THINKING_LEVELS.HIGH),
  Type.Literal(THINKING_LEVELS.XHIGH),
  Type.Literal(THINKING_LEVELS.MAX),
]);

export const PartialAgentConfigSchema = Type.Object(
  {
    required: Type.Optional(Type.Boolean()),
    model: Type.Optional(Type.String()),
    thinking: Type.Optional(ThinkingSchema),
  },
  { additionalProperties: false },
);

export const MaestroConfigInputSchema = Type.Object(
  {
    version: Type.String(),
    specDirectory: Type.Optional(Type.String({ minLength: 1 })),
    builder: Type.Optional(PartialAgentConfigSchema),
    verifier: Type.Optional(PartialAgentConfigSchema),
    simplifier: Type.Optional(PartialAgentConfigSchema),
  },
  { additionalProperties: false },
);

export const ResolvedAgentConfigSchema = Type.Object(
  {
    required: Type.Boolean(),
    model: Type.String(),
    thinking: ThinkingSchema,
  },
  { additionalProperties: false },
);

export const ResolvedMaestroConfigSchema = Type.Object(
  {
    version: Type.Literal(SUPPORTED_CONFIG_VERSION),
    specDirectory: Type.String({ minLength: 1 }),
    builder: ResolvedAgentConfigSchema,
    verifier: ResolvedAgentConfigSchema,
    simplifier: ResolvedAgentConfigSchema,
  },
  { additionalProperties: false },
);

export type MaestroConfig = Static<typeof ResolvedMaestroConfigSchema>;

export type PartialMaestroConfig = Static<typeof MaestroConfigInputSchema>;
