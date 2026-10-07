/**
 * Objective: Build validated paths for one Maestro workflow in the current project.
 * Used: Whenever Maestro reads or writes project workflow artifacts.
 */

import { readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { MaestroConfig } from '#config/schema.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

const PATHS = {
  SPEC_FILE: 'spec.md',
  WORKFLOW_FILE: 'workflow.json',
  HANDOFFS_PATH: 'handoffs',
  BUILDER_HANDOFFS_PATH: 'handoffs/builder',
  VERIFIER_HANDOFFS_PATH: 'handoffs/verifier',
  ESCALATIONS_PATH: 'handoffs/escalations',
  PROTOTYPES_PATH: 'prototypes',
} as const;

const AGENTS_PREFIX = {
  BUILDER: 'B',
  VERIFIER: 'V',
} as const;

function assertSpecId(specId: string): void {
  if (!isValidSpecId(specId)) {
    throw new Error(
      `Invalid spec ID: "${specId}". Expected YYYYMMDD-HHmmss-<slug>.`,
    );
  }
}

function assertArtifactNumber(artifactNumber: number): void {
  if (!Number.isSafeInteger(artifactNumber) || artifactNumber < 1) {
    throw new Error('Artifact number must be a positive integer.');
  }
}

function assertSafeRelativePrototypePath(value: string): void {
  if (value.length === 0 || value.includes('\0')) {
    throw new Error('Prototype path must be a non-empty relative path.');
  }

  if (isAbsolute(value)) {
    throw new Error(
      'Prototype path must be relative to the prototypes directory.',
    );
  }
}

export type MaestroPathsInput = {
  projectRoot: string;
  config: MaestroConfig;
};

type EscalationPathInput = {
  specId: string;
  escalationNumber: number;
};

type HandoffPathInput = {
  specId: string;
  handoffPassNumber: number;
};

type PrototypePathInput = {
  specId: string;
  relativePath: string;
};

export class MaestroPaths {
  private readonly projectRoot: string;
  private readonly specDirectory: string;

  private readonly specDirectoryFromRoot: string;

  public constructor({ projectRoot, config }: MaestroPathsInput) {
    if (
      !isPathStrictlyWithin({
        parent: projectRoot,
        path: config.specDirectory,
      })
    ) {
      throw new Error('Generated Maestro path leaves the project root.');
    }

    this.projectRoot = projectRoot;
    this.specDirectory = config.specDirectory;
    this.specDirectoryFromRoot = relative(projectRoot, config.specDirectory);
  }

  public getProjectRoot(): string {
    return this.projectRoot;
  }

  public getSpecDirectory(): string {
    return this.specDirectory;
  }

  public getSpecPath(specId: string): string {
    assertSpecId(specId);

    return resolve(this.projectRoot, this.specDirectoryFromRoot, specId);
  }

  public getSpecFilePath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.projectRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.SPEC_FILE,
    );
  }

  public getWorkflowPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.projectRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.WORKFLOW_FILE,
    );
  }

  public getHandoffsPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.projectRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.HANDOFFS_PATH,
    );
  }

  public getBuilderHandoffsPath(specId: string): string {
    return resolve(this.getSpecPath(specId), PATHS.BUILDER_HANDOFFS_PATH);
  }

  public getVerifierHandoffsPath(specId: string): string {
    return resolve(this.getSpecPath(specId), PATHS.VERIFIER_HANDOFFS_PATH);
  }

  public getBuilderHandoffPath({
    specId,
    handoffPassNumber,
  }: HandoffPathInput): string {
    assertArtifactNumber(handoffPassNumber);

    return resolve(
      this.getBuilderHandoffsPath(specId),
      `${AGENTS_PREFIX.BUILDER}${handoffPassNumber}.json`,
    );
  }

  public getVerifierHandoffPath({
    specId,
    handoffPassNumber,
  }: HandoffPathInput): string {
    assertArtifactNumber(handoffPassNumber);

    return resolve(
      this.getVerifierHandoffsPath(specId),
      `${AGENTS_PREFIX.VERIFIER}${handoffPassNumber}.json`,
    );
  }

  public async getActiveBuilderHandoffPath(specId: string): Promise<string> {
    const handoffPassNumber = (
      await readdir(this.getBuilderHandoffsPath(specId))
    ).length;

    if (handoffPassNumber === 0) throw new Error('Builder handoff is missing.');

    return this.getBuilderHandoffPath({ specId, handoffPassNumber });
  }

  public async getActiveVerifierHandoffPath(specId: string): Promise<string> {
    const handoffPassNumber = (
      await readdir(this.getVerifierHandoffsPath(specId))
    ).length;

    if (handoffPassNumber === 0)
      throw new Error('Verifier handoff is missing.');

    return this.getVerifierHandoffPath({ specId, handoffPassNumber });
  }

  public async getNextBuilderHandoffPath(specId: string): Promise<string> {
    const handoffPassNumber = (
      await readdir(this.getBuilderHandoffsPath(specId))
    ).length;

    return this.getBuilderHandoffPath({
      specId,
      handoffPassNumber: handoffPassNumber + 1,
    });
  }

  public async getNextVerifierHandoffPath(specId: string): Promise<string> {
    const handoffPassNumber = (
      await readdir(this.getVerifierHandoffsPath(specId))
    ).length;

    return this.getVerifierHandoffPath({
      specId,
      handoffPassNumber: handoffPassNumber + 1,
    });
  }

  public getEscalationsPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.projectRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.ESCALATIONS_PATH,
    );
  }

  public getEscalationPath({
    specId,
    escalationNumber,
  }: EscalationPathInput): string {
    assertArtifactNumber(escalationNumber);
    assertSpecId(specId);

    return resolve(
      this.projectRoot,
      this.specDirectoryFromRoot,
      specId,
      `${PATHS.ESCALATIONS_PATH}/E${escalationNumber}.json`,
    );
  }

  public getPrototypesPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.projectRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.PROTOTYPES_PATH,
    );
  }

  public getPrototypePath({
    specId,
    relativePath,
  }: PrototypePathInput): string {
    assertSafeRelativePrototypePath(relativePath);

    const prototypesPath = this.getPrototypesPath(specId);
    const target = resolve(prototypesPath, relativePath);

    if (!isPathStrictlyWithin({ parent: prototypesPath, path: target })) {
      throw new Error(
        'Prototype path must stay inside the prototypes directory.',
      );
    }

    return target;
  }
}
