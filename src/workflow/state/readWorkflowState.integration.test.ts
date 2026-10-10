import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
} from '#workflow/state/schema.ts';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'pi-maestro-workflow-state-'));
  temporaryDirectories.push(path);

  return path;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('readWorkflowState', () => {
  it('given malformed or invalid workflow state files when read then they are rejected', async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, 'workflow.json');
    await writeFile(path, '{broken', 'utf8');

    await expect(readWorkflowState(path)).rejects.toThrow(
      'Workflow state contains malformed JSON',
    );

    await writeFile(
      path,
      JSON.stringify({
        version: WORKFLOW_STATE_VERSION,
        specId: '20260321-143052-add-weather-alerts',
        phase: WORKFLOW_PHASES.DRAFTING_SPEC,
        extra: true,
      }),
      'utf8',
    );
    await expect(readWorkflowState(path)).rejects.toThrow(
      'Invalid workflow state',
    );
  });
});
