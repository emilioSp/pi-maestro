import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import {
  readWorkflowState,
  writeWorkflowState,
} from '#workflow/state/store.ts';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'pi-maestro-workflow-state-'));
  temporaryDirectories.push(path);
  return path;
};

const state = (revision: number): WorkflowState => ({
  version: WORKFLOW_STATE_VERSION,
  specId: '20260321-143052-add-weather-alerts',
  revision,
  phase:
    revision === 1
      ? WORKFLOW_PHASES.DRAFTING_SPEC
      : WORKFLOW_PHASES.READY_FOR_BUILDER,
  baseBranch: 'main',
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('workflow state store', () => {
  it('creates and atomically replaces validated state', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'workflow.json');

    await writeWorkflowState({
      path,
      state: state(1),
      currentRevision: 0,
    });
    await writeWorkflowState({
      path,
      state: state(2),
      currentRevision: 1,
    });

    await expect(readWorkflowState({ path })).resolves.toEqual(state(2));
    await expect(readFile(path, 'utf8')).resolves.toBe(
      `${JSON.stringify(state(2), null, 2)}\n`,
    );
  });

  it('rejects malformed and unvalidated files on read', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'workflow.json');
    await writeFile(path, '{broken', 'utf8');

    await expect(readWorkflowState({ path })).rejects.toThrow(
      'Workflow state contains malformed JSON',
    );

    await writeFile(path, JSON.stringify({ ...state(1), extra: true }), 'utf8');
    await expect(readWorkflowState({ path })).rejects.toThrow(
      'Invalid workflow state',
    );
  });

  it('rejects stale updates and preserves the old file', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'workflow.json');
    await writeWorkflowState({
      path,
      state: state(1),
      currentRevision: 0,
    });
    const before = await readFile(path, 'utf8');

    await expect(
      writeWorkflowState({
        path,
        state: state(3),
        currentRevision: 2,
      }),
    ).rejects.toThrow('Stale workflow revision: expected 2, found 1.');
    await expect(readFile(path, 'utf8')).resolves.toBe(before);
  });

  it('rejects invalid replacement state and preserves the old file', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'workflow.json');
    await writeWorkflowState({
      path,
      state: state(1),
      currentRevision: 0,
    });
    const before = await readFile(path, 'utf8');

    await expect(
      writeWorkflowState({
        path,
        state: { ...state(2), revision: 0 },
        currentRevision: 1,
      }),
    ).rejects.toThrow('Invalid workflow state');
    await expect(readFile(path, 'utf8')).resolves.toBe(before);
  });

  it('allows only one concurrent update for the same expected revision', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'workflow.json');
    await writeWorkflowState({
      path,
      state: state(1),
      currentRevision: 0,
    });

    const results = await Promise.allSettled([
      writeWorkflowState({ path, state: state(2), currentRevision: 1 }),
      writeWorkflowState({
        path,
        state: { ...state(2), phase: WORKFLOW_PHASES.BUILDER_RUNNING },
        currentRevision: 1,
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    await expect(readWorkflowState({ path })).resolves.toMatchObject({
      revision: 2,
    });
  });
});
