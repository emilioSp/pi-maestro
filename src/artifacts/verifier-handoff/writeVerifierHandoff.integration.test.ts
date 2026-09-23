import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
  type VerifierHandoff,
} from '#artifacts/verifier-handoff/schema.ts';
import { writeVerifierHandoff } from '#artifacts/verifier-handoff/writeVerifierHandoff.ts';

const temporaryDirectories: string[] = [];
const specId = '20260321-143052-add-weather-alerts';

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'pi-maestro-verifier-handoff-'));
  temporaryDirectories.push(path);
  return path;
};

const handoff = (): VerifierHandoff => ({
  version: VERIFIER_HANDOFF_VERSION,
  specId,
  revision: 6,
  summary: 'Regenerated the checks from the candidate commit.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test -- alert',
      probeStatus: PROBE_STATUSES.PASSED,
      breakageStatus: BREAKAGE_STATUSES.CONFIRMED,
    },
  ],
  findings: [
    {
      id: 'F1',
      acceptanceCriterion: 'AC1',
      severity: FINDING_SEVERITIES.LOW,
      confidence: 0.9,
      summary: 'The status message lacks a full stop.',
      evidence: [
        {
          source: 'manual check',
          observation: 'The message has no final punctuation.',
        },
      ],
      rejection: null,
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

describe('verifier handoff writes', () => {
  it('writes and reads a valid verifier handoff', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'verifier.json');

    await writeVerifierHandoff({
      path,
      handoff: handoff(),
      specId,
      revision: 6,
    });

    await expect(
      readVerifierHandoff({ path, specId, revision: 6 }),
    ).resolves.toEqual(handoff());
  });

  it('rejects verifier-supplied rejections without replacing the handoff', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'verifier.json');
    await writeVerifierHandoff({
      path,
      handoff: handoff(),
      specId,
      revision: 6,
    });
    const before = await readFile(path, 'utf8');

    await expect(
      writeVerifierHandoff({
        path,
        handoff: {
          ...handoff(),
          findings: [
            { ...handoff().findings[0], rejection: { reason: 'Ignore it.' } },
          ],
        },
        specId,
        revision: 6,
      }),
    ).rejects.toThrow('New verifier handoff findings must have no rejection');
    await expect(readFile(path, 'utf8')).resolves.toBe(before);
  });
});
