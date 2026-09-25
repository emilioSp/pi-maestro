import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');
const SPEC_ID = '20260321-143052-add-weather-alerts';
const OTHER_SPEC_ID = '20260322-143052-add-weather-alerts';
const cleanupFunctions: Array<() => Promise<void>> = [];

const createRepository = async () => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
  await repository.commit({ message: 'Initial commit' });
  const paths = new MaestroPaths({
    repositoryRoot: repository.path,
    config: {
      ...DEFAULT_CONFIG,
      specDirectory: join(repository.path, '.specs'),
    },
  });

  return { repository, paths };
};

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('markSpecReady', () => {
  it('moves the approved drafting spec to ready without committing', async () => {
    const { repository, paths } = await createRepository();
    const created = await createSpec({
      paths,
      title: 'Add Weather Alerts',
      activeWorkflowSpecId: null,
      instant: INSTANT,
    });
    const markdown = '# Owner-approved content\n';
    await writeFile(created.specFilePath, markdown, 'utf8');
    const headBefore = await getHeadCommit({ repositoryRoot: repository.path });

    await expect(
      markSpecReady({
        paths,
        specId: OTHER_SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(
      `Active workflow spec ID mismatch: expected "${OTHER_SPEC_ID}", found "${SPEC_ID}".`,
    );
    await expect(
      markSpecReady({
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).resolves.toMatchObject({
      revision: 2,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });

    await expect(readFile(created.specFilePath, 'utf8')).resolves.toBe(
      markdown,
    );
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(headBefore);
  });

  it('rejects readiness when spec.md is missing', async () => {
    const { paths } = await createRepository();
    const created = await createSpec({
      paths,
      title: 'Add Weather Alerts',
      activeWorkflowSpecId: null,
      instant: INSTANT,
    });
    await rm(created.specFilePath);

    await expect(
      markSpecReady({
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(`Spec file is missing: ${created.specFilePath}.`);
    await expect(
      readWorkflowState({ path: created.workflowPath }),
    ).resolves.toEqual(created.state);
  });
});
