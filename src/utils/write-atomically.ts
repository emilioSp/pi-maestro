/**
 * Objective: Safely replace a file with complete UTF-8 content.
 * Used: When Maestro writes state or artifact files.
 */

import { randomUUID } from 'node:crypto';
import { type FileHandle, open, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const temporaryPathFor = (path: string): string =>
  join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);

export const writeAtomically = async ({
  path,
  content,
}: {
  path: string;
  content: string;
}): Promise<void> => {
  const temporaryPath = temporaryPathFor(path);
  let file: FileHandle | undefined;

  try {
    file = await open(temporaryPath, 'wx', 0o600);
    await file.writeFile(content, 'utf8');
    await file.sync();
    await file.close();
    file = undefined;
    await rename(temporaryPath, path);
  } finally {
    try {
      if (file !== undefined) {
        await file.close();
      }
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
};
