/**
 * Objective: Build validated paths for one Maestro workflow in the current project.
 * Used: Whenever Maestro reads or writes project workflow artifacts.
 */

import { readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { MaestroConfig } from '#config/schema.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { isErrnoException } from '#utils/is-errno-exception.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

const PATHS = {
  SPEC_FILE: 'spec.md',
  WORKFLOW: 'workflow.json',
  HANDOFFS: 'handoffs',
  BUILDER_HANDOFFS: 'handoffs/builder',
  VERIFIER_HANDOFFS: 'handoffs/verifier',
  ESCALATIONS: 'handoffs/escalations',
  PROTOTYPES: 'prototypes',
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

type ReadHandoffNumbersInput = {
  directory: string;
  prefix: string;
};

const readHandoffNumbers = async ({
  directory,
  prefix,
}: ReadHandoffNumbersInput): Promise<number[]> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const pattern = new RegExp(`^${prefix}([1-9]\\d*)\\.json$`);

    return entries
      .map((entry) => {
        const match = pattern.exec(entry.name);

        if (!entry.isFile() || match === null)
          throw new Error('Handoff history contains an invalid entry.');
        const number = Number(match[1]);
        assertArtifactNumber(number);

        return number;
      })
      .sort((left, right) => left - right);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return [];
    throw error;
  }
};

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
  handoffNumber: number;
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
        candidate: config.specDirectory,
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
      PATHS.WORKFLOW,
    );
  }

  public getHandoffsPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.projectRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.HANDOFFS,
    );
  }

  public getBuilderHandoffsPath(specId: string): string {
    return resolve(this.getSpecPath(specId), PATHS.BUILDER_HANDOFFS);
  }

  public getVerifierHandoffsPath(specId: string): string {
    return resolve(this.getSpecPath(specId), PATHS.VERIFIER_HANDOFFS);
  }

  public getBuilderHandoffPath({
    specId,
    handoffNumber,
  }: HandoffPathInput): string {
    assertArtifactNumber(handoffNumber);

    return resolve(
      this.getBuilderHandoffsPath(specId),
      `B${handoffNumber}.json`,
    );
  }

  public getVerifierHandoffPath({
    specId,
    handoffNumber,
  }: HandoffPathInput): string {
    assertArtifactNumber(handoffNumber);

    return resolve(
      this.getVerifierHandoffsPath(specId),
      `V${handoffNumber}.json`,
    );
  }

  public async getActiveBuilderHandoffPath(specId: string): Promise<string> {
    const numbers = await readHandoffNumbers({
      directory: this.getBuilderHandoffsPath(specId),
      prefix: 'B',
    });

    const handoffNumber = numbers.at(-1);

    if (handoffNumber === undefined)
      throw new Error('Builder handoff is missing.');

    return this.getBuilderHandoffPath({ specId, handoffNumber });
  }

  public async getActiveVerifierHandoffPath(specId: string): Promise<string> {
    const numbers = await readHandoffNumbers({
      directory: this.getVerifierHandoffsPath(specId),
      prefix: 'V',
    });

    const handoffNumber = numbers.at(-1);

    if (handoffNumber === undefined)
      throw new Error('Verifier handoff is missing.');

    return this.getVerifierHandoffPath({ specId, handoffNumber });
  }

  public async getNextBuilderHandoffPath(specId: string): Promise<string> {
    const numbers = await readHandoffNumbers({
      directory: this.getBuilderHandoffsPath(specId),
      prefix: 'B',
    });

    return this.getBuilderHandoffPath({
      specId,
      handoffNumber: (numbers.at(-1) ?? 0) + 1,
    });
  }

  public async getNextVerifierHandoffPath(specId: string): Promise<string> {
    const numbers = await readHandoffNumbers({
      directory: this.getVerifierHandoffsPath(specId),
      prefix: 'V',
    });

    return this.getVerifierHandoffPath({
      specId,
      handoffNumber: (numbers.at(-1) ?? 0) + 1,
    });
  }

  public getEscalationsPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.projectRoot,
      this.specDirectoryFromRoot,
      specId,
      PATHS.ESCALATIONS,
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
      `${PATHS.ESCALATIONS}/E${escalationNumber}.json`,
    );
  }

  public getPrototypesPath(specId: string): string {
    assertSpecId(specId);

    return resolve(
      this.projectRoot,
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
