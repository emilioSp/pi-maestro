/**
 * Objective: Serialize JSON and replace its destination atomically.
 * Used: When Maestro writes workflow state and artifact JSON files.
 * Entrypoint: writeJsonAtomically().
 */

import { writeAtomically } from '#utils/write-atomically.ts';

const jsonContent = (data: unknown): string => {
  const content = JSON.stringify(data, null, 2);
  if (content === undefined) {
    throw new Error('JSON data must be serializable.');
  }

  return `${content}\n`;
};

export const writeJsonAtomically = async ({
  path,
  data,
}: {
  path: string;
  data: unknown;
}): Promise<void> => {
  await writeAtomically({ path, content: jsonContent(data) });
};
