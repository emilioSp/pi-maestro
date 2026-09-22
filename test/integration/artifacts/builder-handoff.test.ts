import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  PROBE_STATUSES,
  readBuilderHandoff,
  writeBuilderHandoff,
} from '#artifacts/builder-handoff.ts';

const temporaryDirectories: string[] = [];
const specId = '20260321-143052-add-weather-alerts';

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'pi-maestro-builder-handoff-'));
  temporaryDirectories.push(path);
  return path;
};

const handoff = (revision: number): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId,
  revision,
  status: BUILDER_HANDOFF_STATUSES.DONE,
  summary: `Implemented revision ${revision}.`,
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test -- alert',
      probeStatus: PROBE_STATUSES.PASSED,
      breakageStatus: BREAKAGE_STATUSES.CONFIRMED,
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

describe('builder handoff store', () => {
  it('atomically replaces a validated handoff', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'builder.json');

    await writeBuilderHandoff({
      path,
      handoff: handoff(4),
      specId,
      revision: 4,
    });
    await writeBuilderHandoff({
      path,
      handoff: handoff(5),
      specId,
      revision: 5,
    });

    await expect(
      readBuilderHandoff({ path, specId, revision: 5 }),
    ).resolves.toEqual(handoff(5));
    await expect(readFile(path, 'utf8')).resolves.toBe(
      `${JSON.stringify(handoff(5), null, 2)}\n`,
    );
  });

  it('rejects invalid writes without replacing the current handoff', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'builder.json');
    await writeBuilderHandoff({
      path,
      handoff: handoff(4),
      specId,
      revision: 4,
    });
    const before = await readFile(path, 'utf8');

    await expect(
      writeBuilderHandoff({
        path,
        handoff: {
          ...handoff(5),
          acceptanceCriteria: [
            {
              ...handoff(5).acceptanceCriteria[0],
              probeStatus: PROBE_STATUSES.FAILED,
            },
          ],
        },
        specId,
        revision: 5,
      }),
    ).rejects.toThrow('Done builder handoff requires every probe to pass');
    await expect(readFile(path, 'utf8')).resolves.toBe(before);
  });

  it('rejects malformed, invalid, and mismatched handoffs on read', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'builder.json');

    await writeFile(path, '{broken', 'utf8');
    await expect(
      readBuilderHandoff({ path, specId, revision: 4 }),
    ).rejects.toThrow('Builder handoff contains malformed JSON');

    await writeFile(
      path,
      JSON.stringify({ ...handoff(4), extra: true }),
      'utf8',
    );
    await expect(
      readBuilderHandoff({ path, specId, revision: 4 }),
    ).rejects.toThrow('Invalid builder handoff');

    await writeFile(path, JSON.stringify(handoff(4)), 'utf8');
    await expect(
      readBuilderHandoff({ path, specId, revision: 5 }),
    ).rejects.toThrow('Builder handoff revision mismatch');
  });
});
