/**
 * Objective: Calculate the SHA-256 digest of a file.
 * Used: When a workflow needs to compare a file with an in-memory baseline.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const getFileSha256 = async (path: string): Promise<string> => {
  const contents = await readFile(path);

  return createHash('sha256').update(contents).digest('hex');
};
