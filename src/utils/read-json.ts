/**
 * Objective: Read JSON files with contextual parse errors.
 * Used: When Maestro loads workflow artifact files.
 */

import { readFile } from 'node:fs/promises';

export const readJsonFile = async ({
  path,
  description,
}: {
  path: string;
  description: string;
}): Promise<unknown> => {
  const content = await readFile(path, 'utf8');

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`${description} contains malformed JSON: ${path}.`, {
      cause: error,
    });
  }
};
