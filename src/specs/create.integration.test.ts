import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, WORKFLOW_STATE_VERSION } from '#workflow/state/schema.ts';

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');

const SPEC_ID = '20260321-143052-add-weather-alerts';

const createWorkspace = async (specDirectory: string = 'custom-specs') => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'pi-maestro-spec-'));
  onTestFinished(() => rm(projectRoot, { force: true, recursive: true }));

  const paths = new MaestroPaths({
    projectRoot,
    config: {
      ...TEST_CONFIG,
      specDirectory: join(projectRoot, specDirectory),
    },
  });

  return { projectRoot, paths };
};

describe('spec template and creation', () => {
  it('GIVEN a custom spec directory WHEN a spec is created THEN proposal and spec drafts are saved with a drafting workflow and prototypes but no design file', async () => {
    const { paths } = await createWorkspace();

    const created = await createSpec({
      paths,
      title: 'Add Weather Alerts',
      activeWorkflowSpecId: null,
      instant: INSTANT,
    });

    expect(created.specId).toBe(SPEC_ID);
    expect(created.specPath).toBe(join(paths.getSpecDirectory(), SPEC_ID));
    await expect(readFile(created.specFilePath, 'utf8')).resolves.toContain(
      `# ${SPEC_ID}: Add Weather Alerts`,
    );
    await expect(readFile(created.proposalFilePath, 'utf8')).resolves.toContain(
      `# ${SPEC_ID}: Add Weather Alerts`,
    );
    expect(created.proposalFilePath).toBe(paths.getProposalFilePath(SPEC_ID));
    expect(created.designFilePath).toBe(paths.getDesignFilePath(SPEC_ID));
    await expect(access(created.designFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readWorkflowState(created.workflowPath)).resolves.toEqual({
      version: WORKFLOW_STATE_VERSION,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });
    expect(created).not.toHaveProperty('escalationsPath');
    expect((await stat(paths.getPrototypesPath(SPEC_ID))).isDirectory()).toBe(true);
  });

  it('GIVEN an existing spec with the same title and timestamp WHEN creation is retried THEN creation fails because the directory exists and the original spec stays unchanged', async () => {
    const { paths } = await createWorkspace();

    const first = await createSpec({
      paths,
      title: 'Add Weather Alerts',
      activeWorkflowSpecId: null,
      instant: INSTANT,
    });

    const before = await readFile(first.specFilePath, 'utf8');
    const proposalBefore = await readFile(first.proposalFilePath, 'utf8');

    await expect(
      createSpec({
        paths,
        title: 'Add Weather Alerts',
        activeWorkflowSpecId: null,
        instant: INSTANT,
      }),
    ).rejects.toMatchObject({ code: 'EEXIST', path: first.specPath });
    await expect(readFile(first.specFilePath, 'utf8')).resolves.toBe(before);
    await expect(readFile(first.proposalFilePath, 'utf8')).resolves.toBe(proposalBefore);
  });

  it('GIVEN another workflow is active WHEN spec creation is requested THEN creation fails without creating the spec directory', async () => {
    const { paths } = await createWorkspace();

    await expect(
      createSpec({
        paths,
        title: 'Add Weather Alerts',
        activeWorkflowSpecId: '20260320-120000-current-workflow',
        instant: INSTANT,
      }),
    ).rejects.toThrow('Workflow 20260320-120000-current-workflow is already active.');
    await expect(access(paths.getSpecDirectory())).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
