import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { rejectVerifierFinding } from '#artifacts/verifier-handoff/rejectVerifierFinding.ts';
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

describe('verifier finding rejection', () => {
  it('records one owner rejection without changing other finding data', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'verifier.json');
    await writeVerifierHandoff({
      path,
      handoff: handoff(),
      specId,
      revision: 6,
    });

    const rejected = await rejectVerifierFinding({
      path,
      specId,
      revision: 6,
      findingId: 'F1',
      reason: 'The owner accepts this style difference.',
    });

    expect(rejected).toEqual({
      ...handoff(),
      findings: [
        {
          ...handoff().findings[0],
          rejection: { reason: 'The owner accepts this style difference.' },
        },
      ],
    });
    await expect(
      rejectVerifierFinding({
        path,
        specId,
        revision: 6,
        findingId: 'F1',
        reason: 'Another reason.',
      }),
    ).rejects.toThrow('already rejected');
  });
});
