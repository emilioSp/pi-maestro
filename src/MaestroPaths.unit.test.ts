import { rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

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
  it('builds every workflow path from the current repository checkout', async () => {
    const repository = await createTemporaryRepository();
    temporaryPaths.push(repository.path);
    const paths = new MaestroPaths({
      repositoryRoot: repository.path,
      config: {
        ...DEFAULT_CONFIG,
        specDirectory: join(repository.path, 'custom/specs'),
      },
    });

    expect(paths.getRepositoryRoot()).toBe(repository.path);
    expect(paths.getSpecDirectory()).toBe(
      join(repository.path, 'custom/specs'),
    );
    expect(paths.getSpecPath(SPEC_ID)).toBe(
      join(repository.path, 'custom/specs', SPEC_ID),
    );
    expect(paths.getSpecFilePath(SPEC_ID)).toBe(
      join(repository.path, 'custom/specs', SPEC_ID, 'spec.md'),
    );
    expect(paths.getWorkflowPath(SPEC_ID)).toBe(
      join(repository.path, 'custom/specs', SPEC_ID, 'workflow.json'),
    );
    expect(paths.getVerifierHandoffPath(SPEC_ID)).toBe(
      join(
        repository.path,
        'custom/specs',
        SPEC_ID,
        'handoffs',
        'verifier.json',
      ),
    );
    expect(
      paths.getEscalationPath({ specId: SPEC_ID, escalationNumber: 2 }),
    ).toBe(
      join(
        repository.path,
        'custom/specs',
        SPEC_ID,
        'handoffs/escalations/E2.json',
      ),
    );
  });

  it('keeps generated artifact paths inside the repository', async () => {
    const repository = await createTemporaryRepository();
    temporaryPaths.push(repository.path);
    const paths = new MaestroPaths({
      repositoryRoot: repository.path,
      config: {
        ...DEFAULT_CONFIG,
        specDirectory: join(repository.path, '.specs'),
      },
    });
    const generatedPaths = [
      paths.getSpecPath(SPEC_ID),
      paths.getSpecFilePath(SPEC_ID),
      paths.getWorkflowPath(SPEC_ID),
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
    ];

    for (const path of generatedPaths) {
      expectInside({ root: paths.getRepositoryRoot(), path });
    }

    expect(() => paths.getSpecPath('../outside')).toThrow('Invalid spec ID');
    expect(() =>
      paths.getPrototypePath({
        specId: SPEC_ID,
        relativePath: '../outside.html',
      }),
    ).toThrow('Prototype path must stay inside the prototypes directory.');
  });

  it('rejects a configured spec directory outside the repository root', () => {
    expect(
      () =>
        new MaestroPaths({
          repositoryRoot: '/repo',
          config: { ...DEFAULT_CONFIG, specDirectory: '/outside' },
        }),
    ).toThrow('Generated Maestro path leaves the Git root.');
  });
});
