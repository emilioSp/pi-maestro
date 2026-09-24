/**
 * Objective: Build and validate Maestro paths from configuration.
 * Used: When any workflow operation needs a repository path.
 */

import { isAbsolute, relative, resolve } from 'node:path';
import type { MaestroConfig } from '#config/schema.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

export const WORKFLOW_ROLES = {
  BUILDER: 'builder',
  VERIFIER: 'verifier',
} as const;

export type WorkflowRoles =
  (typeof WORKFLOW_ROLES)[keyof typeof WORKFLOW_ROLES];

const PATHS = {
  SPEC_FILE: 'spec.md',
  WORKFLOW: 'workflow.json',
  HANDOFFS: 'handoffs',
  BUILDER_HANDOFF: 'handoffs/builder.json',
  VERIFIER_HANDOFF: 'handoffs/verifier.json',
  ESCALATIONS: 'handoffs/escalations',
  PROTOTYPES: 'prototypes',
} as const;

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
  getWorkflowPathInWorktree: (input: {
    specId: string;
    worktreePath: string;
  }) => string;
  getBuilderHandoffPathInWorktree: (input: {
    specId: string;
    worktreePath: string;
  }) => string;
  getVerifierHandoffPathInWorktree: (input: {
    specId: string;
    worktreePath: string;
  }) => string;
  getEscalationsPathInWorktree: (input: {
    specId: string;
    worktreePath: string;
  }) => string;
  getEscalationPathInWorktree: (input: {
    specId: string;
    escalationNumber: number;
    worktreePath: string;
  }) => string;
};

export const getMaestroPaths = ({
  repositoryRoot,
  config,
}: MaestroPathsInput): GetMaestroPaths => {
  for (const directory of [config.specDirectory, config.worktreeDirectory]) {
    if (
      !isPathStrictlyWithin({ parent: repositoryRoot, candidate: directory })
    ) {
      throw new Error('Generated Maestro path leaves the Git root.');
    }
  }

  const specDirectoryFromRoot = relative(repositoryRoot, config.specDirectory);

  // "Where is this file for this spec, under this root?"
  const getSpecPathAtRoot = ({
    root,
    specId,
    name,
  }: {
    root: string;
    specId: string;
    name: string;
  }): string => {
    assertSpecId(specId);
    return resolve(root, specDirectoryFromRoot, specId, name);
  };

  const getPrototypesPath = (specId: string): string =>
    getSpecPathAtRoot({ root: repositoryRoot, specId, name: PATHS.PROTOTYPES });

  return Object.freeze({
    repositoryRoot,
    specDirectory: config.specDirectory,
    worktreeDirectory: config.worktreeDirectory,
    getSpecPath: (specId: string): string =>
      getSpecPathAtRoot({ root: repositoryRoot, specId, name: '' }),
    getSpecFilePath: (specId: string): string =>
      getSpecPathAtRoot({
        root: repositoryRoot,
        specId,
        name: PATHS.SPEC_FILE,
      }),
    getWorkflowPath: (specId: string): string =>
      getSpecPathAtRoot({ root: repositoryRoot, specId, name: PATHS.WORKFLOW }),
    getHandoffsPath: (specId: string): string =>
      getSpecPathAtRoot({ root: repositoryRoot, specId, name: PATHS.HANDOFFS }),
    getBuilderHandoffPath: (specId: string): string =>
      getSpecPathAtRoot({
        root: repositoryRoot,
        specId,
        name: PATHS.BUILDER_HANDOFF,
      }),
    getVerifierHandoffPath: (specId: string): string =>
      getSpecPathAtRoot({
        root: repositoryRoot,
        specId,
        name: PATHS.VERIFIER_HANDOFF,
      }),
    getEscalationsPath: (specId: string): string =>
      getSpecPathAtRoot({
        root: repositoryRoot,
        specId,
        name: PATHS.ESCALATIONS,
      }),
    getEscalationPath: ({ specId, escalationNumber }): string => {
      assertEscalationNumber(escalationNumber);
      return getSpecPathAtRoot({
        root: repositoryRoot,
        specId,
        name: `${PATHS.ESCALATIONS}/E${escalationNumber}.json`,
      });
    },
    getPrototypesPath,
    getPrototypePath: ({ specId, relativePath }): string => {
      assertSafeRelativePrototypePath(relativePath);
      const prototypesPath = getPrototypesPath(specId);
      const target = resolve(prototypesPath, relativePath);

      if (
        !isPathStrictlyWithin({ parent: prototypesPath, candidate: target })
      ) {
        throw new Error(
          'Prototype path must stay inside the prototypes directory.',
        );
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
      return resolve(config.worktreeDirectory, WORKFLOW_ROLES.BUILDER, specId);
    },
    getVerifierWorktreePath: ({ specId, pass }): string => {
      assertSpecId(specId);
      assertPass(pass);
      return resolve(
        config.worktreeDirectory,
        WORKFLOW_ROLES.VERIFIER,
        specId,
        String(pass),
      );
    },
    getWorkflowPathInWorktree: ({ specId, worktreePath }): string =>
      getSpecPathAtRoot({ root: worktreePath, specId, name: PATHS.WORKFLOW }),
    getBuilderHandoffPathInWorktree: ({ specId, worktreePath }): string =>
      getSpecPathAtRoot({
        root: worktreePath,
        specId,
        name: PATHS.BUILDER_HANDOFF,
      }),
    getVerifierHandoffPathInWorktree: ({ specId, worktreePath }): string =>
      getSpecPathAtRoot({
        root: worktreePath,
        specId,
        name: PATHS.VERIFIER_HANDOFF,
      }),
    getEscalationsPathInWorktree: ({ specId, worktreePath }): string =>
      getSpecPathAtRoot({
        root: worktreePath,
        specId,
        name: PATHS.ESCALATIONS,
      }),
    getEscalationPathInWorktree: ({
      specId,
      escalationNumber,
      worktreePath,
    }): string => {
      assertEscalationNumber(escalationNumber);
      return getSpecPathAtRoot({
        root: worktreePath,
        specId,
        name: `${PATHS.ESCALATIONS}/E${escalationNumber}.json`,
      });
    },
  });
};
