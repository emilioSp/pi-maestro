/**
 * Objective: Define the fixed simplifier result contract.
 * Used: When a simplifier submits or Maestro reads its handoff.
 */

import { type Static, Type } from 'typebox';

import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';

export const SIMPLIFIER_HANDOFF_VERSION = '1.0.0';

export const SimplifierSubmissionFields = {
  specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
  refactoredFiles: Type.Array(Type.String({ minLength: 1 })),
  summary: Type.String({ minLength: 1 }),
  notes: Type.Array(Type.String()),
};

export const SimplifierHandoffSchema = Type.Object(
  {
    version: Type.Literal(SIMPLIFIER_HANDOFF_VERSION),
    ...SimplifierSubmissionFields,
  },
  { additionalProperties: false },
);

export type SimplifierHandoff = Static<typeof SimplifierHandoffSchema>;
