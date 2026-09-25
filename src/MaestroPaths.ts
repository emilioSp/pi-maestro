/**
 * Objective: Build and validate Maestro paths from configuration.
 * Used: When any workflow operation needs a repository path.
 */

import { isAbsolute, relative, resolve } from 'node:path';
import type { MaestroConfig } from '#config/schema.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';

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

type SpecPathAtRootInput = {
  root: string;
  specId: string;
  name: string;
};

type EscalationPathInput = {
  specId: string;
  escalationNumber: number;
};

type PrototypePathInput = {
  specId: string;
  relativePath: string;
};

type VerifierBranchInput = {
  specId: string;
  pass: number;
};

type WorktreePathInput = {
  specId: string;
  worktreePath: string;
};

type VerifierWorktreePathInput = {
  specId: string;
  pass: number;
};

type EscalationPathInWorktreeInput = {
  specId: string;
  escalationNumber: number;
  worktreePath: string;
};

export class MaestroPaths {
  private readonly repositoryRoot: string;
  private readonly specDirectory: string;
  private readonly worktreeDirectory: string;

  private readonly specDirectoryFromRoot: string;

  public constructor({ repositoryRoot, config }: MaestroPathsInput) {
    for (const directory of [config.specDirectory, config.worktreeDirectory]) {
      if (
        !isPathStrictlyWithin({ parent: repositoryRoot, candidate: directory })
      ) {
        throw new Error('Generated Maestro path leaves the Git root.');
      }
    }

    this.repositoryRoot = repositoryRoot;
    this.specDirectory = config.specDirectory;
    this.worktreeDirectory = config.worktreeDirectory;
    this.specDirectoryFromRoot = relative(repositoryRoot, config.specDirectory);
  }

  public getRepositoryRoot(): string {
    return this.repositoryRoot;
  }

  public getSpecDirectory(): string {
    return this.specDirectory;
  }

  public getWorktreeDirectory(): string {
    return this.worktreeDirectory;
  }

  private getSpecPathAtRoot({
    root,
    specId,
    name,
  }: SpecPathAtRootInput): string {
    assertSpecId(specId);

    return resolve(root, this.specDirectoryFromRoot, specId, name);
  }

  public getSpecPath(specId: string): string {
    return this.getSpecPathAtRoot({
      root: this.repositoryRoot,
      specId,
      name: '',
    });
  }

  public getSpecFilePath(specId: string): string {
    return this.getSpecPathAtRoot({
      root: this.repositoryRoot,
      specId,
      name: PATHS.SPEC_FILE,
    });
  }

  public getWorkflowPath(specId: string): string {
    return this.getSpecPathAtRoot({
      root: this.repositoryRoot,
      specId,
      name: PATHS.WORKFLOW,
    });
  }

  public getHandoffsPath(specId: string): string {
    return this.getSpecPathAtRoot({
      root: this.repositoryRoot,
      specId,
      name: PATHS.HANDOFFS,
    });
  }

  public getBuilderHandoffPath(specId: string): string {
    return this.getSpecPathAtRoot({
      root: this.repositoryRoot,
      specId,
      name: PATHS.BUILDER_HANDOFF,
    });
  }

  public getVerifierHandoffPath(specId: string): string {
    return this.getSpecPathAtRoot({
      root: this.repositoryRoot,
      specId,
      name: PATHS.VERIFIER_HANDOFF,
    });
  }

  public getEscalationsPath(specId: string): string {
    return this.getSpecPathAtRoot({
      root: this.repositoryRoot,
      specId,
      name: PATHS.ESCALATIONS,
    });
  }

  public getEscalationPath({
    specId,
    escalationNumber,
  }: EscalationPathInput): string {
    assertEscalationNumber(escalationNumber);

    return this.getSpecPathAtRoot({
      root: this.repositoryRoot,
      specId,
      name: `${PATHS.ESCALATIONS}/E${escalationNumber}.json`,
    });
  }

  public getPrototypesPath(specId: string): string {
    return this.getSpecPathAtRoot({
      root: this.repositoryRoot,
      specId,
      name: PATHS.PROTOTYPES,
    });
  }

  public getPrototypePath({
    specId,
    relativePath,
  }: PrototypePathInput): string {
    assertSafeRelativePrototypePath(relativePath);

    const prototypesPath = this.getPrototypesPath(specId);
    const target = resolve(prototypesPath, relativePath);

    if (!isPathStrictlyWithin({ parent: prototypesPath, candidate: target })) {
      throw new Error(
        'Prototype path must stay inside the prototypes directory.',
      );
    }

    return target;
  }

  public getBuilderBranch(specId: string): string {
    assertSpecId(specId);

    return `${WORKFLOW_ROLES.BUILDER}/${specId}`;
  }

  public getVerifierBranch({ specId, pass }: VerifierBranchInput): string {
    assertSpecId(specId);
    assertPass(pass);

    return `${WORKFLOW_ROLES.VERIFIER}/${specId}/${pass}`;
  }

  public getBuilderWorktreePath(specId: string): string {
    assertSpecId(specId);

    return resolve(this.worktreeDirectory, WORKFLOW_ROLES.BUILDER, specId);
  }

  public getVerifierWorktreePath({
    specId,
    pass,
  }: VerifierWorktreePathInput): string {
    assertSpecId(specId);
    assertPass(pass);

    return resolve(
      this.worktreeDirectory,
      WORKFLOW_ROLES.VERIFIER,
      specId,
      String(pass),
    );
  }

  public getWorkflowPathInWorktree({
    specId,
    worktreePath,
  }: WorktreePathInput): string {
    return this.getSpecPathAtRoot({
      root: worktreePath,
      specId,
      name: PATHS.WORKFLOW,
    });
  }

  public getBuilderHandoffPathInWorktree({
    specId,
    worktreePath,
  }: WorktreePathInput): string {
    return this.getSpecPathAtRoot({
      root: worktreePath,
      specId,
      name: PATHS.BUILDER_HANDOFF,
    });
  }

  public getVerifierHandoffPathInWorktree({
    specId,
    worktreePath,
  }: WorktreePathInput): string {
    return this.getSpecPathAtRoot({
      root: worktreePath,
      specId,
      name: PATHS.VERIFIER_HANDOFF,
    });
  }

  public getEscalationsPathInWorktree({
    specId,
    worktreePath,
  }: WorktreePathInput): string {
    return this.getSpecPathAtRoot({
      root: worktreePath,
      specId,
      name: PATHS.ESCALATIONS,
    });
  }

  public getEscalationPathInWorktree({
    specId,
    escalationNumber,
    worktreePath,
  }: EscalationPathInWorktreeInput): string {
    assertEscalationNumber(escalationNumber);

    return this.getSpecPathAtRoot({
      root: worktreePath,
      specId,
      name: `${PATHS.ESCALATIONS}/E${escalationNumber}.json`,
    });
  }
}
