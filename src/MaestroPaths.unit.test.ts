import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('Maestro paths', () => {
  it('given builder and verifier reports numbered 1 through 10 when report paths are requested then report 10 is active and report 11 is next for each agent', async () => {
    const project = await createTemporaryProject();
    temporaryPaths.push(project.path);

    const paths = new MaestroPaths({
      projectRoot: project.path,
      config: {
        ...DEFAULT_CONFIG,
        specDirectory: join(project.path, '.specs'),
      },
    });

    await mkdir(paths.getBuilderHandoffsPath(SPEC_ID), { recursive: true });
    await mkdir(paths.getVerifierHandoffsPath(SPEC_ID), { recursive: true });

    for (let handoffPassNumber = 1; handoffPassNumber <= 10; handoffPassNumber += 1) {
      // Path lookup only needs directory entries
      await writeFile(paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffPassNumber }), '');
      await writeFile(paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber }), '');
    }

    await expect(paths.getActiveBuilderHandoffPath(SPEC_ID)).resolves.toBe(
      paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffPassNumber: 10 }),
    );
    await expect(paths.getActiveVerifierHandoffPath(SPEC_ID)).resolves.toBe(
      paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 10 }),
    );
    await expect(paths.getNextBuilderHandoffPath(SPEC_ID)).resolves.toBe(
      paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffPassNumber: 11 }),
    );
    await expect(paths.getNextVerifierHandoffPath(SPEC_ID)).resolves.toBe(
      paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 11 }),
    );
  });

  it('given a custom spec directory when spec, workflow, and report paths are requested then all paths use that directory inside the project', () => {
    const projectRoot = '/repo';

    const paths = new MaestroPaths({
      projectRoot,
      config: {
        ...DEFAULT_CONFIG,
        specDirectory: join(projectRoot, 'custom/specs'),
      },
    });

    expect(paths.getProjectRoot()).toBe(projectRoot);
    expect(paths.getSpecDirectory()).toBe(join(projectRoot, 'custom/specs'));
    expect(paths.getSpecPath(SPEC_ID)).toBe(join(projectRoot, 'custom/specs', SPEC_ID));
    expect(paths.getSpecFilePath(SPEC_ID)).toBe(
      join(projectRoot, 'custom/specs', SPEC_ID, 'spec.md'),
    );
    expect(paths.getWorkflowPath(SPEC_ID)).toBe(
      join(projectRoot, 'custom/specs', SPEC_ID, 'workflow.json'),
    );
    expect(paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 })).toBe(
      join(projectRoot, 'custom/specs', SPEC_ID, 'handoffs', 'verifier', 'V1.json'),
    );
  });

  it('given spec and prototype paths when Maestro builds their full paths then valid paths stay inside the project and attempts to leave their allowed directories throw errors', () => {
    const projectRoot = '/repo';

    const paths = new MaestroPaths({
      projectRoot,
      config: {
        ...DEFAULT_CONFIG,
        specDirectory: join(projectRoot, '.specs'),
      },
    });

    const generatedPaths = [
      paths.getSpecPath(SPEC_ID),
      paths.getSpecFilePath(SPEC_ID),
      paths.getWorkflowPath(SPEC_ID),
      paths.getHandoffsPath(SPEC_ID),
      paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }),
      paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }),
      paths.getPrototypesPath(SPEC_ID),
      paths.getPrototypePath({
        specId: SPEC_ID,
        relativePath: 'nested/review.html',
      }),
    ];

    for (const path of generatedPaths) {
      const pathFromRoot = relative(projectRoot, path);
      expect(pathFromRoot === '..' || pathFromRoot.startsWith('../')).toBe(false);
    }

    expect(() => paths.getSpecPath('../outside')).toThrow('Invalid spec ID');
    expect(() =>
      paths.getPrototypePath({
        specId: SPEC_ID,
        relativePath: '../outside.html',
      }),
    ).toThrow('Prototype path must stay inside the prototypes directory.');
  });

  it('given a spec directory outside the project when MaestroPaths is created then it throws an error that the path leaves the project root', () => {
    expect(
      () =>
        new MaestroPaths({
          projectRoot: '/repo',
          config: { ...DEFAULT_CONFIG, specDirectory: '/outside' },
        }),
    ).toThrow('Generated Maestro path leaves the project root.');
  });
});
