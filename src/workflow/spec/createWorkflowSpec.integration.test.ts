import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { getMaestroPaths } from '#paths.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { createWorkflowSpec } from '#workflow/spec/createWorkflowSpec.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');
const SPEC_ID = '20260321-143052-add-weather-alerts';
const cleanupFunctions: Array<() => Promise<void>> = [];

const createRepository = async () => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
  await repository.commit({ message: 'Initial commit' });

  const paths = getMaestroPaths({
    repositoryRoot: repository.path,
    config: {
      ...DEFAULT_CONFIG,
      specDirectory: join(repository.path, '.specs'),
      worktreeDirectory: join(repository.path, '.worktree'),
    },
  });

  return { paths };
};

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('createWorkflowSpec', () => {
  it('creates a drafting spec after confirming that no workflow is active', async () => {
    const { paths } = await createRepository();

    const created = await createWorkflowSpec({
      paths,
      title: 'Add Weather Alerts',
      baseBranch: 'main',
      instant: INSTANT,
    });

    expect(created.specId).toBe(SPEC_ID);
    expect(created.state.phase).toBe(WORKFLOW_PHASES.DRAFTING_SPEC);
  });

  it('rejects creation while a workflow is active', async () => {
    const { paths } = await createRepository();
    await createWorkflowSpec({
      paths,
      title: 'Add Weather Alerts',
      baseBranch: 'main',
      instant: INSTANT,
    });

    await expect(
      createWorkflowSpec({
        paths,
        title: 'Add Forecasts',
        baseBranch: 'main',
        instant: Temporal.Instant.from('2026-03-21T14:31:52Z'),
      }),
    ).rejects.toThrow(`Workflow ${SPEC_ID} is already active.`);
  });
});
