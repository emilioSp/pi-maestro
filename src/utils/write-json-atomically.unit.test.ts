import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'pi-maestro-atomic-write-'));
  temporaryDirectories.push(path);
  return path;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('atomic JSON writes', () => {
  it('writes formatted JSON with a final newline', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'artifact.json');

    await writeJsonAtomically({
      path,
      data: { title: 'weather', enabled: true },
    });

    await expect(readFile(path, 'utf8')).resolves.toBe(
      '{\n  "title": "weather",\n  "enabled": true\n}\n',
    );
  });
});
