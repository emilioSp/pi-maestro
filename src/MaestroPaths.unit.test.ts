import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import { MaestroPaths } from '#MaestroPaths.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';

describe('Maestro paths', () => {
  it('GIVEN builder and verifier reports numbered 1 through 10 WHEN report paths are requested THEN report 10 is active and report 11 is next for each agent', async () => {
    const project = await createTemporaryProject();
    onTestFinished(project.cleanup);

    const paths = new MaestroPaths({
      projectRoot: project.path,
      config: {
        ...TEST_CONFIG,
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

  it('GIVEN a custom spec directory WHEN spec, workflow, and report paths are requested THEN all paths use that directory inside the project', () => {
    const projectRoot = '/repo';

    const paths = new MaestroPaths({
      projectRoot,
      config: {
        ...TEST_CONFIG,
        specDirectory: join(projectRoot, 'custom/specs'),
      },
    });

    expect(paths.getProjectRoot()).toBe(projectRoot);
    expect(paths.getSpecDirectory()).toBe(join(projectRoot, 'custom/specs'));
    expect(paths.getSpecPath(SPEC_ID)).toBe(join(projectRoot, 'custom/specs', SPEC_ID));
    expect(paths.getProposalFilePath(SPEC_ID)).toBe(
      join(projectRoot, 'custom/specs', SPEC_ID, 'proposal.md'),
    );
    expect(paths.getDesignFilePath(SPEC_ID)).toBe(
      join(projectRoot, 'custom/specs', SPEC_ID, 'design.md'),
    );
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

  it('GIVEN spec and prototype paths WHEN Maestro builds their full paths THEN valid paths stay inside the project and attempts to leave their allowed directories throw errors', () => {
    const projectRoot = '/repo';

    const paths = new MaestroPaths({
      projectRoot,
      config: {
        ...TEST_CONFIG,
        specDirectory: join(projectRoot, '.specs'),
      },
    });

    const generatedPaths = [
      paths.getSpecPath(SPEC_ID),
      paths.getProposalFilePath(SPEC_ID),
      paths.getSpecFilePath(SPEC_ID),
      paths.getDesignFilePath(SPEC_ID),
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

  it('GIVEN a spec directory outside the project WHEN MaestroPaths is created THEN it throws an error that the path leaves the project root', () => {
    expect(
      () =>
        new MaestroPaths({
          projectRoot: '/repo',
          config: { ...TEST_CONFIG, specDirectory: '/outside' },
        }),
    ).toThrow('Generated Maestro path leaves the project root.');
  });
});
