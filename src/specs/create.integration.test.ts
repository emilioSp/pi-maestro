import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
} from '#workflow/state/schema.ts';

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');

const SPEC_ID = '20260321-143052-add-weather-alerts';

const temporaryDirectories: string[] = [];

const createWorkspace = async (specDirectory: string = 'custom-specs') => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), 'pi-maestro-spec-'));
  temporaryDirectories.push(repositoryRoot);

  const paths = new MaestroPaths({
    repositoryRoot,
    config: {
      ...DEFAULT_CONFIG,
      specDirectory: join(repositoryRoot, specDirectory),
    },
  });

  return { repositoryRoot, paths };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('spec template and creation', () => {
  it('creates a drafting spec in the configured directory', async () => {
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
    await expect(readWorkflowState(created.workflowPath)).resolves.toEqual({
      version: WORKFLOW_STATE_VERSION,
      specId: SPEC_ID,
      revision: 1,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });
    expect((await stat(paths.getEscalationsPath(SPEC_ID))).isDirectory()).toBe(
      true,
    );
    expect((await stat(paths.getPrototypesPath(SPEC_ID))).isDirectory()).toBe(
      true,
    );
  });

  it('blocks a same-second collision without overwriting the existing spec', async () => {
    const { paths } = await createWorkspace();

    const first = await createSpec({
      paths,
      title: 'Add Weather Alerts',
      activeWorkflowSpecId: null,
      instant: INSTANT,
    });

    const before = await readFile(first.specFilePath, 'utf8');

    await expect(
      createSpec({
        paths,
        title: 'Add Weather Alerts',
        activeWorkflowSpecId: null,
        instant: INSTANT,
      }),
    ).rejects.toThrow(`Spec directory already exists: ${first.specPath}.`);
    await expect(readFile(first.specFilePath, 'utf8')).resolves.toBe(before);
  });

  it('rejects creation while another workflow is active without writing', async () => {
    const { paths } = await createWorkspace();

    await expect(
      createSpec({
        paths,
        title: 'Add Weather Alerts',
        activeWorkflowSpecId: '20260320-120000-current-workflow',
        instant: INSTANT,
      }),
    ).rejects.toThrow(
      'Workflow 20260320-120000-current-workflow is already active.',
    );
    await expect(access(paths.getSpecDirectory())).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
