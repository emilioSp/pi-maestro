/**
 * Objective: Write formatted JSON to a file.
 * Used: When Maestro writes workflow state and artifact JSON files.
 */

import { writeFile } from 'node:fs/promises';

type WriteJsonInput = {
  path: string;
  data: unknown;
};

export const writeJson = async ({
  path,
  data,
}: WriteJsonInput): Promise<void> => {
  const content = JSON.stringify(data, null, 2);

  if (content === undefined) {
    throw new Error('JSON data must be serializable.');
  }

  await writeFile(path, `${content}\n`);
};
