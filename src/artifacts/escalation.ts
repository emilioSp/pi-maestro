/**
 * Objective: Validate, create, and resolve builder escalations.
 * Used: When a builder needs an owner decision.
 * Entrypoint: createEscalation().
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type Static, Type } from 'typebox';
import { Value } from 'typebox/value';
import { writeJsonAtomically } from '#atomic-write.ts';
import { isValidSpecId, SPEC_ID_PATTERN } from '#ids.ts';
import { readJsonFile } from '#utils/read-json.ts';

export const ESCALATION_VERSION = '1.0.0';

const ESCALATION_ID_PATTERN = /^E([1-9]\d*)$/;
const ESCALATION_FILE_PATTERN = /^E([1-9]\d*)\.json$/;

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

const hasOption = (escalation: Escalation, optionId: string): boolean =>
  escalation.options.some((option) => option.id === optionId);

export const validateEscalation = (input: unknown): Escalation => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Escalation must be a JSON object.');
  }

  const [error] = Value.Errors(EscalationSchema, input);
  if (error !== undefined) {
    throw new Error(`Invalid escalation: ${error.message}.`);
  }

  const escalation = input as Escalation;
  if (!isValidSpecId(escalation.specId)) {
    throw new Error(`Invalid escalation spec ID: "${escalation.specId}".`);
  }
  if (
    new Set(escalation.options.map((option) => option.id)).size !==
    escalation.options.length
  ) {
    throw new Error('Escalation option IDs must be unique.');
  }
  if (
    escalation.recommendation !== null &&
    !hasOption(escalation, escalation.recommendation.optionId)
  ) {
    throw new Error(
      `Escalation recommendation references unknown option "${escalation.recommendation.optionId}".`,
    );
  }
  if (
    escalation.resolution !== null &&
    escalation.resolution.selectedOptionId !== null &&
    !hasOption(escalation, escalation.resolution.selectedOptionId)
  ) {
    throw new Error(
      `Escalation resolution references unknown option "${escalation.resolution.selectedOptionId}".`,
    );
  }

  return escalation;
};

const validateWorkflowEscalation = ({
  escalation,
  specId,
  currentRevision,
}: {
  escalation: Escalation;
  specId: string;
  currentRevision: number;
}): Escalation => {
  if (escalation.specId !== specId) {
    throw new Error(
      `Escalation spec ID mismatch: expected "${specId}", found "${escalation.specId}".`,
    );
  }
  if (escalation.revision > currentRevision) {
    throw new Error(
      `Escalation revision ${escalation.revision} is newer than workflow revision ${currentRevision}.`,
    );
  }

  return escalation;
};

export const readEscalation = async ({
  path,
  specId,
  currentRevision,
}: {
  path: string;
  specId: string;
  currentRevision: number;
}): Promise<Escalation> =>
  validateWorkflowEscalation({
    escalation: validateEscalation(
      await readJsonFile({ path, description: 'Escalation' }),
    ),
    specId,
    currentRevision,
  });

export const readEscalationHistory = async ({
  directory,
  specId,
  currentRevision,
}: {
  directory: string;
  specId: string;
  currentRevision: number;
}): Promise<Escalation[]> => {
  const files = await readdir(directory);
  if (!files.every((file) => ESCALATION_FILE_PATTERN.test(file))) {
    throw new Error('Escalation history contains an invalid entry.');
  }

  const orderedFiles = files.sort(
    (left, right) => Number(left.slice(1, -5)) - Number(right.slice(1, -5)),
  );
  const escalations: Escalation[] = [];
  for (const [index, file] of orderedFiles.entries()) {
    const expectedId = `E${index + 1}`;
    if (file !== `${expectedId}.json`) {
      throw new Error(
        `Escalation history has a gap: expected ${expectedId}, found "${file}".`,
      );
    }

    const escalation = await readEscalation({
      path: join(directory, file),
      specId,
      currentRevision,
    });
    if (escalation.id !== expectedId) {
      throw new Error(
        `Escalation history ID mismatch: file "${file}" contains "${escalation.id}".`,
      );
    }
    escalations.push(escalation);
  }

  return escalations;
};

export const getNextEscalationId = async ({
  directory,
  specId,
  currentRevision,
}: {
  directory: string;
  specId: string;
  currentRevision: number;
}): Promise<string> => {
  const history = await readEscalationHistory({
    directory,
    specId,
    currentRevision,
  });
  return `E${history.length + 1}`;
};

export const createEscalation = async ({
  directory,
  specId,
  revision,
  escalation,
}: {
  directory: string;
  specId: string;
  revision: number;
  escalation: NewEscalation;
}): Promise<{ path: string; escalation: Escalation }> => {
  const id = await getNextEscalationId({
    directory,
    specId,
    currentRevision: revision,
  });
  const newEscalation = validateEscalation({
    ...escalation,
    version: ESCALATION_VERSION,
    specId,
    revision,
    id,
    resolution: null,
  });
  const path = join(directory, `${id}.json`);
  await writeJsonAtomically({ path, data: newEscalation });

  return { path, escalation: newEscalation };
};

export const resolveEscalation = async ({
  path,
  specId,
  revision,
  resolution,
}: {
  path: string;
  specId: string;
  revision: number;
  resolution: EscalationResolution;
}): Promise<Escalation> => {
  const current = await readEscalation({
    path,
    specId,
    currentRevision: revision,
  });
  if (current.resolution !== null) {
    throw new Error(`Escalation "${current.id}" is already resolved.`);
  }
  if (revision <= current.revision) {
    throw new Error(
      `Escalation resolution revision must be greater than ${current.revision}.`,
    );
  }

  const resolvedEscalation = validateEscalation({
    ...current,
    revision,
    resolution,
  });
  await writeJsonAtomically({ path, data: resolvedEscalation });

  return resolvedEscalation;
};
