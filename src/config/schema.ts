/**
 * Objective: Define the input and resolved configuration contracts.
 * Used: When configuration is validated or resolved.
 */

import { type Static, Type } from 'typebox';

export const AGENTS = {
  BUILDER: 'maestro/builder',
  VERIFIER: 'maestro/verifier',
} as const;

export const THINKING_LEVELS = {
  OFF: 'off',
  MINIMAL: 'minimal',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  XHIGH: 'xhigh',
  MAX: 'max',
} as const;

export type ThinkingLevel =
  (typeof THINKING_LEVELS)[keyof typeof THINKING_LEVELS];

export const MODEL_PATTERN = '^[^/\\s]+/[^/\\s]+$';

export const SUPPORTED_CONFIG_VERSION = '1.0.0';
export const MIN_TIMEOUT_MINUTES = 1;
export const MAX_TIMEOUT_MINUTES = 1440;

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
    model: Type.Optional(Type.String({ pattern: MODEL_PATTERN })),
    thinking: Type.Optional(ThinkingSchema),
    timeoutMinutes: Type.Optional(
      Type.Integer({
        minimum: MIN_TIMEOUT_MINUTES,
        maximum: MAX_TIMEOUT_MINUTES,
      }),
    ),
  },
  { additionalProperties: false },
);

export const MaestroConfigInputSchema = Type.Object(
  {
    version: Type.String(),
    specDirectory: Type.Optional(Type.String({ minLength: 1 })),
    worktreeDirectory: Type.Optional(Type.String({ minLength: 1 })),
    builder: Type.Optional(PartialAgentConfigSchema),
    verifier: Type.Optional(PartialAgentConfigSchema),
  },
  { additionalProperties: false },
);

export const ResolvedAgentConfigSchema = Type.Object(
  {
    model: Type.String({ pattern: MODEL_PATTERN }),
    thinking: ThinkingSchema,
    timeoutMinutes: Type.Integer({
      minimum: MIN_TIMEOUT_MINUTES,
      maximum: MAX_TIMEOUT_MINUTES,
    }),
  },
  { additionalProperties: false },
);

export const ResolvedMaestroConfigSchema = Type.Object(
  {
    version: Type.Literal(SUPPORTED_CONFIG_VERSION),
    specDirectory: Type.String({ minLength: 1 }),
    worktreeDirectory: Type.String({ minLength: 1 }),
    builder: ResolvedAgentConfigSchema,
    verifier: ResolvedAgentConfigSchema,
  },
  { additionalProperties: false },
);

export type MaestroConfig = Static<typeof ResolvedMaestroConfigSchema>;
export type PartialMaestroConfig = Static<typeof MaestroConfigInputSchema>;
