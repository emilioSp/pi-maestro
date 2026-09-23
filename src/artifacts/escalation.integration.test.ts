import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createEscalation,
  type EscalationResolution,
  getNextEscalationId,
  type NewEscalation,
  resolveEscalation,
} from '#artifacts/escalation.ts';

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

describe('escalation artifacts', () => {
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

  it('resolves an escalation once without changing its other fields', async () => {
    const directory = await createTemporaryDirectory();
    const created = await createEscalation({
      directory,
      specId,
      revision: 3,
      escalation: newEscalation(),
    });
    const before = await readFile(created.path, 'utf8');

    const resolved = await resolveEscalation({
      path: created.path,
      specId,
      revision: 4,
      resolution: resolution(),
    });

    expect(resolved).toEqual({
      ...created.escalation,
      revision: 4,
      resolution: resolution(),
    });
    expect(await readFile(created.path, 'utf8')).not.toBe(before);
    await expect(
      resolveEscalation({
        path: created.path,
        specId,
        revision: 5,
        resolution: resolution(),
      }),
    ).rejects.toThrow('already resolved');
  });
});
