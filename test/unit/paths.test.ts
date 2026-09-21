import { rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { getMaestroPaths } from '#paths.ts';
import { createTemporaryRepository } from '../support/temp-repository.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';
const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

const expectInside = ({ root, path }: { root: string; path: string }): void => {
  const pathFromRoot = relative(root, path);
  expect(pathFromRoot === '..' || pathFromRoot.startsWith('../')).toBe(false);
};

describe('Maestro paths', () => {
  it('builds all paths and resource names from validated configuration', async () => {
    const repository = await createTemporaryRepository();
    temporaryPaths.push(repository.path);

    const paths = getMaestroPaths({
      repositoryRoot: repository.path,
      config: {
        ...DEFAULT_CONFIG,
        specDirectory: join(repository.path, 'custom/specs'),
        worktreeDirectory: join(repository.path, 'custom/worktrees'),
      },
    });

    const root = paths.repositoryRoot;
    expect(paths.specDirectory).toBe(join(root, 'custom/specs'));
    expect(paths.worktreeDirectory).toBe(join(root, 'custom/worktrees'));
    expect(paths.getSpecPath(SPEC_ID)).toBe(
      join(root, 'custom/specs', SPEC_ID),
    );
    expect(paths.getSpecFilePath(SPEC_ID)).toBe(
      join(root, 'custom/specs', SPEC_ID, 'spec.md'),
    );
    expect(paths.getWorkflowPath(SPEC_ID)).toBe(
      join(root, 'custom/specs', SPEC_ID, 'workflow.json'),
    );
    expect(paths.getObservationsPath(SPEC_ID)).toBe(
      join(root, 'custom/specs', SPEC_ID, 'observations.json'),
    );
    expect(paths.getBuilderHandoffPath(SPEC_ID)).toBe(
      join(root, 'custom/specs', SPEC_ID, 'handoffs', 'builder.json'),
    );
    expect(paths.getVerifierHandoffPath(SPEC_ID)).toBe(
      join(root, 'custom/specs', SPEC_ID, 'handoffs', 'verifier.json'),
    );
    expect(
      paths.getEscalationPath({ specId: SPEC_ID, escalationNumber: 2 }),
    ).toBe(
      join(root, 'custom/specs', SPEC_ID, 'handoffs', 'escalations', 'E2.json'),
    );
    expect(
      paths.getPrototypePath({ specId: SPEC_ID, relativePath: 'review.html' }),
    ).toBe(join(root, 'custom/specs', SPEC_ID, 'prototypes', 'review.html'));
    expect(paths.getBuilderBranch(SPEC_ID)).toBe(`builder/${SPEC_ID}`);
    expect(paths.getVerifierBranch({ specId: SPEC_ID, pass: 2 })).toBe(
      `verifier/${SPEC_ID}/2`,
    );
    expect(paths.getBuilderWorktreePath(SPEC_ID)).toBe(
      join(root, 'custom/worktrees', 'builder', SPEC_ID),
    );
    expect(paths.getVerifierWorktreePath({ specId: SPEC_ID, pass: 2 })).toBe(
      join(root, 'custom/worktrees', 'verifier', SPEC_ID, '2'),
    );
  });

  it('keeps generated artifact paths inside the repository', async () => {
    const repository = await createTemporaryRepository();
    temporaryPaths.push(repository.path);
    const paths = getMaestroPaths({
      repositoryRoot: repository.path,
      config: {
        ...DEFAULT_CONFIG,
        specDirectory: join(repository.path, '.specs'),
        worktreeDirectory: join(repository.path, '.worktree'),
      },
    });

    const generatedPaths = [
      paths.getSpecPath(SPEC_ID),
      paths.getSpecFilePath(SPEC_ID),
      paths.getWorkflowPath(SPEC_ID),
      paths.getObservationsPath(SPEC_ID),
      paths.getHandoffsPath(SPEC_ID),
      paths.getBuilderHandoffPath(SPEC_ID),
      paths.getVerifierHandoffPath(SPEC_ID),
      paths.getEscalationsPath(SPEC_ID),
      paths.getEscalationPath({ specId: SPEC_ID, escalationNumber: 1 }),
      paths.getPrototypesPath(SPEC_ID),
      paths.getPrototypePath({
        specId: SPEC_ID,
        relativePath: 'nested/review.html',
      }),
      paths.getBuilderWorktreePath(SPEC_ID),
      paths.getVerifierWorktreePath({ specId: SPEC_ID, pass: 1 }),
    ];

    for (const path of generatedPaths) {
      expectInside({ root: paths.repositoryRoot, path });
    }

    expect(() =>
      paths.getPrototypePath({
        specId: SPEC_ID,
        relativePath: '../outside.html',
      }),
    ).toThrow('Prototype path must stay inside the prototypes directory.');
    expect(() => paths.getSpecPath('../outside')).toThrow('Invalid spec ID');
  });
});
