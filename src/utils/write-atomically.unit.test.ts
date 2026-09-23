import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeAtomically } from '#utils/write-atomically.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'pi-maestro-atomic-write-'));
  temporaryDirectories.push(path);
  return path;
};

const expectNoTemporaryFiles = async (directory: string): Promise<void> => {
  const entries = await readdir(directory);
  expect(entries.some((entry) => entry.endsWith('.tmp'))).toBe(false);
};

describe('atomic text writes', () => {
  it('writes a new UTF-8 text file', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'message.txt');

    await writeAtomically({ path, content: 'Caffè ☕' });

    await expect(readFile(path, 'utf8')).resolves.toBe('Caffè ☕');
  });

  it('replaces an existing file', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'message.txt');
    await writeFile(path, 'old content', 'utf8');

    await writeAtomically({ path, content: 'new content' });

    await expect(readFile(path, 'utf8')).resolves.toBe('new content');
  });

  it('preserves the destination after a write failure', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'message.txt');
    await writeFile(path, 'old content', 'utf8');
    await chmod(directory, 0o500);

    try {
      await expect(
        writeAtomically({ path, content: 'new content' }),
      ).rejects.toThrow();
    } finally {
      await chmod(directory, 0o700);
    }

    await expect(readFile(path, 'utf8')).resolves.toBe('old content');
    await expectNoTemporaryFiles(directory);
  });

  it('preserves the destination and removes the temporary file after a rename failure', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'message.txt');
    await mkdir(path);

    await expect(
      writeAtomically({ path, content: 'new content' }),
    ).rejects.toThrow();

    const destination = await stat(path);
    expect(destination.isDirectory()).toBe(true);
    await expectNoTemporaryFiles(directory);
  });

  it('uses unique temporary files for concurrent writes', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'message.txt');

    await Promise.all([
      writeAtomically({ path, content: 'first' }),
      writeAtomically({ path, content: 'second' }),
    ]);

    await expect(readFile(path, 'utf8')).resolves.toMatch(/^(first|second)$/);
    await expectNoTemporaryFiles(directory);
  });
});
