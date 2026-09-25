/**
 * Objective: Build validated paths for one Maestro workflow in the current checkout.
 * Used: Whenever Maestro reads or writes repository workflow artifacts.
 */

import { isAbsolute, relative, resolve } from 'node:path';
import type { MaestroConfig } from '#config/schema.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

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

type EscalationPathInput = {
  specId: string;
  escalationNumber: number;
};

type PrototypePathInput = {
  specId: string;
  relativePath: string;
};

export class MaestroPaths {
  private readonly repositoryRoot: string;
  private readonly specDirectory: string;

  private readonly specDirectoryFromRoot: string;

  public constructor({ repositoryRoot, config }: MaestroPathsInput) {
    if (
      !isPathStrictlyWithin({
        parent: repositoryRoot,
        candidate: config.specDirectory,
      })
    ) {
      throw new Error('Generated Maestro path leaves the Git root.');
    }

    this.repositoryRoot = repositoryRoot;
    this.specDirectory = config.specDirectory;
    this.specDirectoryFromRoot = relative(repositoryRoot, config.specDirectory);
  }

  public getRepositoryRoot(): string {
    return this.repositoryRoot;
  }

  public getSpecDirectory(): string {
    return this.specDirectory;
  }

  public getSpecPath(specId: string): string {
    assertSpecId(specId);

    return resolve(this.repositoryRoot, this.specDirectoryFromRoot, specId);
  }

  public getSpecFilePath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.repositoryRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.SPEC_FILE,
    );
  }

  public getWorkflowPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.repositoryRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.WORKFLOW,
    );
  }

  public getHandoffsPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.repositoryRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.HANDOFFS,
    );
  }

  public getBuilderHandoffPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.repositoryRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.BUILDER_HANDOFF,
    );
  }

  public getVerifierHandoffPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.repositoryRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.VERIFIER_HANDOFF,
    );
  }

  public getEscalationsPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.repositoryRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.ESCALATIONS,
    );
  }

  public getEscalationPath({
    specId,
    escalationNumber,
  }: EscalationPathInput): string {
    assertEscalationNumber(escalationNumber);
    assertSpecId(specId);

    return resolve(
      this.repositoryRoot,
      this.specDirectoryFromRoot,
      specId,
      `${PATHS.ESCALATIONS}/E${escalationNumber}.json`,
    );
  }

  public getPrototypesPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.repositoryRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.PROTOTYPES,
    );
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
}
