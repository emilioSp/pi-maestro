/**
 * Objective: Build and validate Maestro paths from configuration.
 * Used: When any workflow operation needs a repository path.
 * Entrypoint: getMaestroPaths().
 */

import { isAbsolute, resolve } from 'node:path';
import type { MaestroConfig } from '#config/schema.ts';
import { isValidSpecId } from '#ids.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

export const WORKFLOW_ROLES = {
  BUILDER: 'builder',
  VERIFIER: 'verifier',
} as const;

export type WorkflowRoles =
  (typeof WORKFLOW_ROLES)[keyof typeof WORKFLOW_ROLES];

const assertSpecId = (specId: string): void => {
  if (!isValidSpecId(specId)) {
    throw new Error(
      `Invalid spec ID: "${specId}". Expected YYYYMMDD-HHmmss-<slug>.`,
    );
  }
};

const assertPass = (pass: number): void => {
  if (!Number.isSafeInteger(pass) || pass < 1) {
    throw new Error('Pass number must be a positive integer.');
  }
};

const assertEscalationNumber = (escalationNumber: number): void => {
  if (!Number.isSafeInteger(escalationNumber) || escalationNumber < 1) {
    throw new Error('Escalation number must be a positive integer.');
  }
};

const assertSafeRelativePrototypePath = (value: string): void => {
  if (value.length === 0 || value.includes('\0')) {
    throw new Error('Prototype path must be a non-empty relative path.');
  }

  if (isAbsolute(value)) {
    throw new Error(
      'Prototype path must be relative to the prototypes directory.',
    );
  }
};

export type MaestroPathsInput = {
  repositoryRoot: string;
  config: MaestroConfig;
};

export type GetMaestroPaths = {
  repositoryRoot: string;
  specDirectory: string;
  worktreeDirectory: string;
  getSpecPath: (specId: string) => string;
  getSpecFilePath: (specId: string) => string;
  getWorkflowPath: (specId: string) => string;
  getHandoffsPath: (specId: string) => string;
  getBuilderHandoffPath: (specId: string) => string;
  getVerifierHandoffPath: (specId: string) => string;
  getEscalationsPath: (specId: string) => string;
  getEscalationPath: (input: {
    specId: string;
    escalationNumber: number;
  }) => string;
  getPrototypesPath: (specId: string) => string;
  getPrototypePath: (input: { specId: string; relativePath: string }) => string;
  getBuilderBranch: (specId: string) => string;
  getVerifierBranch: (input: { specId: string; pass: number }) => string;
  getBuilderWorktreePath: (specId: string) => string;
  getVerifierWorktreePath: (input: { specId: string; pass: number }) => string;
};

export const getMaestroPaths = ({
  repositoryRoot,
  config,
}: MaestroPathsInput): GetMaestroPaths => {
  const getSpecPath = (specId: string): string => {
    assertSpecId(specId);
    return resolve(config.specDirectory, specId);
  };

  const pathInSpec = ({
    specId,
    path,
  }: {
    specId: string;
    path: string;
  }): string => {
    const target = resolve(getSpecPath(specId), path);
    if (!isPathStrictlyWithin({ parent: repositoryRoot, candidate: target })) {
      throw new Error('Generated Maestro path leaves the Git root.');
    }
    return target;
  };

  const getPrototypesPath = (specId: string): string =>
    pathInSpec({ specId, path: 'prototypes' });

  return Object.freeze({
    repositoryRoot,
    specDirectory: config.specDirectory,
    worktreeDirectory: config.worktreeDirectory,
    getSpecPath,
    getSpecFilePath: (specId: string): string =>
      pathInSpec({ specId, path: 'spec.md' }),
    getWorkflowPath: (specId: string): string =>
      pathInSpec({ specId, path: 'workflow.json' }),
    getHandoffsPath: (specId: string): string =>
      pathInSpec({ specId, path: 'handoffs' }),
    getBuilderHandoffPath: (specId: string): string =>
      pathInSpec({ specId, path: 'handoffs/builder.json' }),
    getVerifierHandoffPath: (specId: string): string =>
      pathInSpec({ specId, path: 'handoffs/verifier.json' }),
    getEscalationsPath: (specId: string): string =>
      pathInSpec({ specId, path: 'handoffs/escalations' }),
    getEscalationPath: ({ specId, escalationNumber }): string => {
      assertEscalationNumber(escalationNumber);
      return pathInSpec({
        specId,
        path: `handoffs/escalations/E${escalationNumber}.json`,
      });
    },
    getPrototypesPath,
    getPrototypePath: ({ specId, relativePath }): string => {
      assertSafeRelativePrototypePath(relativePath);
      const target = resolve(getPrototypesPath(specId), relativePath);
      if (
        !isPathStrictlyWithin({
          parent: getPrototypesPath(specId),
          candidate: target,
        })
      ) {
        throw new Error(
          'Prototype path must stay inside the prototypes directory.',
        );
      }
      if (
        !isPathStrictlyWithin({ parent: repositoryRoot, candidate: target })
      ) {
        throw new Error('Generated Maestro path leaves the Git root.');
      }
      return target;
    },
    getBuilderBranch: (specId: string): string => {
      assertSpecId(specId);
      return `${WORKFLOW_ROLES.BUILDER}/${specId}`;
    },
    getVerifierBranch: ({ specId, pass }): string => {
      assertSpecId(specId);
      assertPass(pass);
      return `${WORKFLOW_ROLES.VERIFIER}/${specId}/${pass}`;
    },
    getBuilderWorktreePath: (specId: string): string => {
      assertSpecId(specId);
      const target = resolve(
        config.worktreeDirectory,
        WORKFLOW_ROLES.BUILDER,
        specId,
      );
      if (
        !isPathStrictlyWithin({ parent: repositoryRoot, candidate: target })
      ) {
        throw new Error('Generated Maestro path leaves the Git root.');
      }
      return target;
    },
    getVerifierWorktreePath: ({ specId, pass }): string => {
      assertSpecId(specId);
      assertPass(pass);
      const target = resolve(
        config.worktreeDirectory,
        WORKFLOW_ROLES.VERIFIER,
        specId,
        String(pass),
      );
      if (
        !isPathStrictlyWithin({ parent: repositoryRoot, candidate: target })
      ) {
        throw new Error('Generated Maestro path leaves the Git root.');
      }
      return target;
    },
  });
};
