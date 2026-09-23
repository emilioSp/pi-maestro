import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEscalation } from '#artifacts/escalation/createEscalation.ts';
import { getNextEscalationId } from '#artifacts/escalation/getNextEscalationId.ts';
import type {
  EscalationResolution,
  NewEscalation,
} from '#artifacts/escalation/schema.ts';

const temporaryDirectories: string[] = [];
const specId = '20260321-143052-add-weather-alerts';

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'pi-maestro-escalation-'));
  temporaryDirectories.push(path);
  return path;
};

const newEscalation = (): NewEscalation => ({
  question: 'Which persistence strategy should be used?',
  context: 'The approved behavior has two valid implementations.',
  options: [
    {
      id: 'A',
      description: 'Store the value in the existing settings file.',
      consequences: 'The value follows the settings lifecycle.',
      nextStep: 'Implement the existing settings adapter.',
    },
  ],
  recommendation: null,
  notes: [],
});

const resolution = (): EscalationResolution => ({
  selectedOptionId: 'A',
  decision: 'Use option A.',
  reason: 'The owner selected the existing adapter.',
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('escalation creation', () => {
  it('allocates sequential IDs from validated history', async () => {
    const directory = await createTemporaryDirectory();

    const first = await createEscalation({
      directory,
      specId,
      revision: 3,
      escalation: newEscalation(),
    });
    const second = await createEscalation({
      directory,
      specId,
      revision: 4,
      escalation: newEscalation(),
    });

    expect(first.escalation.id).toBe('E1');
    expect(second.escalation.id).toBe('E2');
    await expect(readFile(first.path, 'utf8')).resolves.toBe(
      `${JSON.stringify(first.escalation, null, 2)}\n`,
    );
    await expect(
      getNextEscalationId({ directory, specId, currentRevision: 4 }),
    ).resolves.toBe('E3');
  });

  it('writes new escalations as unresolved documents', async () => {
    const directory = await createTemporaryDirectory();

    const { escalation } = await createEscalation({
      directory,
      specId,
      revision: 3,
      escalation: {
        ...newEscalation(),
        resolution: resolution(),
      } as NewEscalation,
    });

    expect(escalation.resolution).toBeNull();
  });
});
