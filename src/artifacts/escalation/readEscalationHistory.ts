/**
 * Objective: Read and order validated escalation history.
 * Used: When Maestro handles escalation artifacts.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readEscalation } from '#artifacts/escalation/readEscalation.ts';
import type { Escalation } from '#artifacts/escalation/schema.ts';

const ESCALATION_FILE_PATTERN = /^E([1-9]\d*)\.json$/;

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

  for (const file of orderedFiles.values()) {
    const escalation = await readEscalation({
      path: join(directory, file),
      specId,
      currentRevision,
    });
    escalations.push(escalation);
  }

  return escalations;
};
