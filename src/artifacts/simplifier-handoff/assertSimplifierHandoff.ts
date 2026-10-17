/**
 * Objective: Validate the simplifier result and its project-relative file paths.
 * Used: Before reading or saving a simplifier handoff.
 */

import { isAbsolute, resolve } from 'node:path';

import { Value } from 'typebox/value';

import {
  type SimplifierHandoff,
  SimplifierHandoffSchema,
} from '#artifacts/simplifier-handoff/schema.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

type AssertSimplifierHandoffInput<Handoff = unknown> = {
  handoff: Handoff;
  specId: string;
  projectRoot: string;
};

function assertSimplifierHandoffSchema(input: unknown): asserts input is SimplifierHandoff {
  const [error] = Value.Errors(SimplifierHandoffSchema, input);

  if (error !== undefined) {
    throw new Error(`Invalid simplifier handoff: ${error.message}.`);
  }
}

export function assertSimplifierHandoff(
  input: AssertSimplifierHandoffInput,
): asserts input is AssertSimplifierHandoffInput<SimplifierHandoff> {
  assertSimplifierHandoffSchema(input.handoff);
  const { handoff } = input;

  if (handoff.specId !== input.specId) {
    throw new Error(
      `Simplifier handoff spec ID mismatch: expected "${input.specId}", found "${handoff.specId}".`,
    );
  }

  for (const file of handoff.refactoredFiles) {
    if (
      file.includes('\0') ||
      isAbsolute(file) ||
      !isPathStrictlyWithin({
        parent: input.projectRoot,
        path: resolve(input.projectRoot, file),
      })
    ) {
      throw new Error(
        `Refactored file path must be relative and stay inside the project root: "${file}".`,
      );
    }
  }
}
