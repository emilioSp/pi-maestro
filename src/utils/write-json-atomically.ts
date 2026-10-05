/**
 * Objective: Serialize JSON and replace its destination atomically.
 * Used: When Maestro writes workflow state and artifact JSON files.
 */

import { writeAtomically } from '#utils/write-atomically.ts';

const jsonContent = (data: unknown): string => {
  const content = JSON.stringify(data, null, 2);

  if (content === undefined) {
    throw new Error('JSON data must be serializable.');
  }

  return `${content}\n`;
};

type WriteJsonAtomicallyInput = {
  path: string;
  data: unknown;
};

export const writeJsonAtomically = async ({
  path,
  data,
}: WriteJsonAtomicallyInput): Promise<void> => {
  await writeAtomically({ path, content: jsonContent(data) });
};
