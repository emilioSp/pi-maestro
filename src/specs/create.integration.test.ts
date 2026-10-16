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
  const projectRoot = await mkdtemp(join(tmpdir(), 'pi-maestro-spec-'));
  temporaryDirectories.push(projectRoot);

  const paths = new MaestroPaths({
    projectRoot,
    config: {
      ...DEFAULT_CONFIG,
      specDirectory: join(projectRoot, specDirectory),
    },
  });

  return { projectRoot, paths };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('spec template and creation', () => {
  it('given a custom spec directory when a spec is created then that directory receives the spec file, drafting-spec workflow, and prototypes directory', async () => {
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
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });
    expect(created).not.toHaveProperty('escalationsPath');
    expect((await stat(paths.getPrototypesPath(SPEC_ID))).isDirectory()).toBe(
      true,
    );
  });

  it('given an existing spec with the same title and timestamp when creation is retried then creation fails because the directory exists and the original spec stays unchanged', async () => {
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
    ).rejects.toMatchObject({ code: 'EEXIST', path: first.specPath });
    await expect(readFile(first.specFilePath, 'utf8')).resolves.toBe(before);
  });

  it('given another workflow is active when spec creation is requested then creation fails without creating the spec directory', async () => {
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
