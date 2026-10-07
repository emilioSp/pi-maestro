import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { writeBuilderHandoff } from '#artifacts/builder-handoff/writeBuilderHandoff.ts';

const temporaryDirectories: string[] = [];

const specId = '20260321-143052-add-weather-alerts';

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'pi-maestro-builder-handoff-'));
  temporaryDirectories.push(path);

  return path;
};

const handoff = (summary: string): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId,
  status: BUILDER_HANDOFF_STATUSES.DONE,
  summary,
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test -- alert',
      probeStatus: PROBE_STATUSES.PASSED,
    },
  ],
  notes: [],
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('builder handoff writes', () => {
  it('replaces a validated handoff', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'B1.json');

    await writeBuilderHandoff({
      path,
      handoff: handoff('Implemented greeting'),
      specId,
    });
    await writeBuilderHandoff({
      path,
      handoff: handoff('Fixed greeting'),
      specId,
    });

    await expect(readBuilderHandoff({ path, specId })).resolves.toEqual(
      handoff('Fixed greeting'),
    );
    await expect(readFile(path, 'utf8')).resolves.toBe(
      `${JSON.stringify(handoff('Fixed greeting'), null, 2)}\n`,
    );
  });

  it('rejects invalid writes without replacing the current handoff', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'B1.json');
    await writeBuilderHandoff({
      path,
      handoff: handoff('Implemented greeting'),
      specId,
    });
    const before = await readFile(path, 'utf8');

    await expect(
      writeBuilderHandoff({
        path,
        handoff: {
          ...handoff('Fixed greeting'),
          acceptanceCriteria: [
            {
              ...handoff('Fixed greeting').acceptanceCriteria[0],
              probeStatus: PROBE_STATUSES.FAILED,
            },
          ],
        },
        specId,
      }),
    ).rejects.toThrow('Done builder handoff requires every probe to pass');
    await expect(readFile(path, 'utf8')).resolves.toBe(before);
  });
});
