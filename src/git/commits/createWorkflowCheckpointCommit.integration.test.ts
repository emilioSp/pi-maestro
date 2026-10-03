import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKFLOW_CHECKPOINT_COMMIT_MESSAGE } from '#git/commits/createCommit.ts';
import { createWorkflowCheckpointCommit } from '#git/commits/createWorkflowCheckpointCommit.ts';
import { findCommitByMessage } from '#git/commits/findCommitByMessage.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('workflow checkpoint commit creation', () => {
  it('creates a checkpoint with the standard workflow message', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    await writeFile(join(repository.path, 'workflow.json'), '{}\n', 'utf8');
    await repository.commit({ message: 'Initial commit' });
    await writeFile(
      join(repository.path, 'workflow.json'),
      '{"revision":1}\n',
      'utf8',
    );

    const commit = await createWorkflowCheckpointCommit({
      repositoryRoot: repository.path,
      expectedPaths: [join(repository.path, 'workflow.json')],
    });

    await expect(
      findCommitByMessage({
        repositoryRoot: repository.path,
        message: WORKFLOW_CHECKPOINT_COMMIT_MESSAGE,
      }),
    ).resolves.toBe(commit);
  });
});
