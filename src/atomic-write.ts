// Shared atomic file writing.

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

export const writeJsonAtomically = async ({
  path,
  data,
}: {
  path: string;
  data: unknown;
}): Promise<void> => {
  const content = JSON.stringify(data, null, 2);
  if (content === undefined) {
    throw new Error('JSON data must be serializable.');
  }

  await writeAtomically({ path, content: `${content}\n` });
};
