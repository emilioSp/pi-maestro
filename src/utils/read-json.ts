/**
 * Objective: Read JSON files with contextual parse errors.
 * Used: When Maestro loads workflow artifact files.
 */

import { readFile } from 'node:fs/promises';

type ReadJsonFileInput = {
  path: string;
  description: string;
};

export const readJsonFile = async ({
  path,
  description,
}: ReadJsonFileInput): Promise<unknown> => {
  const content = await readFile(path, 'utf8');

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`${description} contains malformed JSON: ${path}.`, {
      cause: error,
    });
  }
};
