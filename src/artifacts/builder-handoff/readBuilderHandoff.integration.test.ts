import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';

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

describe('builder handoff reads', () => {
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
