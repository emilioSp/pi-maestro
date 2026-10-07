import { mkdir, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
} from '#artifacts/builder-handoff/schema.ts';
import { writeBuilderHandoff } from '#artifacts/builder-handoff/writeBuilderHandoff.ts';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { writeVerifierHandoff } from '#artifacts/verifier-handoff/writeVerifierHandoff.ts';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createTemporaryProject } from '#test/support/temp-repository.ts';

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
  it('given handoffs numbered 9 and 10 for both roles then the active handoffs are numbered 10', async () => {
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

    for (const handoffNumber of [9, 10]) {
      await writeBuilderHandoff({
        path: paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffNumber }),
        specId: SPEC_ID,
        handoff: {
          version: BUILDER_HANDOFF_VERSION,
          specId: SPEC_ID,
          status: BUILDER_HANDOFF_STATUSES.DONE,
          summary: 'Implemented greeting',
          acceptanceCriteria: [],
          notes: [],
        },
      });
      await writeVerifierHandoff({
        path: paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffNumber }),
        specId: SPEC_ID,
        handoff: {
          version: VERIFIER_HANDOFF_VERSION,
          specId: SPEC_ID,
          summary: 'Checked greeting',
          acceptanceCriteria: [],
          findings: [],
          notes: [],
        },
      });
    }

    await expect(paths.getActiveBuilderHandoffPath(SPEC_ID)).resolves.toBe(
      paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffNumber: 10 }),
    );
    await expect(paths.getActiveVerifierHandoffPath(SPEC_ID)).resolves.toBe(
      paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffNumber: 10 }),
    );
    await expect(paths.getNextBuilderHandoffPath(SPEC_ID)).resolves.toBe(
      paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffNumber: 11 }),
    );
    await expect(paths.getNextVerifierHandoffPath(SPEC_ID)).resolves.toBe(
      paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffNumber: 11 }),
    );
  });

  it('builds every workflow path from the current repository checkout', async () => {
    const repository = await createTemporaryProject();
    temporaryPaths.push(repository.path);

    const paths = new MaestroPaths({
      projectRoot: repository.path,
      config: {
        ...DEFAULT_CONFIG,
        specDirectory: join(repository.path, 'custom/specs'),
      },
    });

    expect(paths.getProjectRoot()).toBe(repository.path);
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
    expect(
      paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffNumber: 1 }),
    ).toBe(
      join(
        repository.path,
        'custom/specs',
        SPEC_ID,
        'handoffs',
        'verifier',
        'V1.json',
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
    const repository = await createTemporaryProject();
    temporaryPaths.push(repository.path);

    const paths = new MaestroPaths({
      projectRoot: repository.path,
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
      paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffNumber: 1 }),
      paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffNumber: 1 }),
      paths.getEscalationsPath(SPEC_ID),
      paths.getEscalationPath({ specId: SPEC_ID, escalationNumber: 1 }),
      paths.getPrototypesPath(SPEC_ID),
      paths.getPrototypePath({
        specId: SPEC_ID,
        relativePath: 'nested/review.html',
      }),
    ];

    for (const path of generatedPaths) {
      expectInside({ root: paths.getProjectRoot(), path });
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
          projectRoot: '/repo',
          config: { ...DEFAULT_CONFIG, specDirectory: '/outside' },
        }),
    ).toThrow('Generated Maestro path leaves the project root.');
  });
});
