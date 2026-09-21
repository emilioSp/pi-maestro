import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createEscalation,
  type Escalation,
  type EscalationResolution,
  getNextEscalationId,
  type NewEscalation,
  readEscalationHistory,
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

const savedEscalation = ({
  id,
  revision,
}: {
  id: string;
  revision: number;
}): Escalation => ({
  ...newEscalation(),
  version: '1.0.0',
  specId,
  revision,
  id,
  resolution: null,
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

  it('rejects a gap or malformed entry in the history', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(
      join(directory, 'E2.json'),
      JSON.stringify(savedEscalation({ id: 'E2', revision: 3 })),
      'utf8',
    );

    await expect(
      getNextEscalationId({ directory, specId, currentRevision: 3 }),
    ).rejects.toThrow('Escalation history has a gap');

    await rm(join(directory, 'E2.json'));
    await writeFile(join(directory, 'E1.json'), '{broken', 'utf8');
    await expect(
      readEscalationHistory({ directory, specId, currentRevision: 3 }),
    ).rejects.toThrow('Escalation contains malformed JSON');
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
