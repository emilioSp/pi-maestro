/**
 * Objective: Gather the approved contract, available handoffs, and complete final Git changes.
 * Used: By the scoring operation before any evaluation output is written.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import type { MaestroPaths } from '#MaestroPaths.ts';
import { pathExists } from '#utils/path-exists.ts';

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const EVALUATION_FILES = ['evaluation.json', 'evaluation.raw.json'];

type ReadDocumentInput = { path: string; name: string };

const readDocument = async ({ path, name }: ReadDocumentInput) => {
  const content = await readFile(path, 'utf8');

  if (!content.trim()) throw new Error(`Required evidence ${name} is empty.`);

  return { name, content };
};

const collectHandoffs = async (directory: string): Promise<{ name: string; content: string }[]> => {
  if (!(await pathExists(directory))) return [];
  const files = await readdir(directory, { recursive: true, withFileTypes: true });

  const names = files
    .filter((file) => file.isFile())
    .map((file) => join(file.parentPath, file.name).slice(directory.length + 1))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  return Promise.all(
    names.map(async (name) => {
      const document = await readDocument({ path: join(directory, name), name });

      if (name.endsWith('.json')) {
        const parsed: unknown = JSON.parse(document.content);

        if (!isJsonObject(parsed)) {
          throw new Error(`Malformed handoff evidence ${name}: expected a JSON object.`);
        }
      }

      return document;
    }),
  );
};

type GitInput = {
  pi: ExtensionAPI;
  paths: MaestroPaths;
  signal?: AbortSignal;
  args: string[];
  allowedCodes?: number[];
};

const git = async ({ pi, paths, signal, args, allowedCodes = [0] }: GitInput): Promise<string> => {
  const result = await pi.exec('git', ['--no-pager', ...args], {
    cwd: paths.getProjectRoot(),
    signal,
  });

  if (result.truncated) throw new Error('Incomplete Git evidence: output is truncated.');

  if (result.killed || !allowedCodes.includes(result.code)) {
    throw new Error(
      `Git evidence collection failed (${args[0]}): ${result.stderr.trim() || result.code}`,
    );
  }

  return result.stdout;
};

export type WorkflowEvidence = {
  documents: { name: string; content: string }[];
  handoffs: { name: string; content: string }[];
  trackedDiff: string;
  untrackedFiles: { name: string; diff: string }[];
};

type CollectWorkflowEvidenceInput = {
  pi: ExtensionAPI;
  paths: MaestroPaths;
  specId: string;
  signal?: AbortSignal;
};

export const collectWorkflowEvidence = async ({
  pi,
  paths,
  specId,
  signal,
}: CollectWorkflowEvidenceInput): Promise<WorkflowEvidence> => {
  try {
    await git({ pi, paths, signal, args: ['rev-parse', '--verify', 'HEAD'] });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Git HEAD baseline unavailable: ${reason}`, { cause: error });
  }

  const documents = await Promise.all([
    readDocument({ path: paths.getProposalFilePath(specId), name: 'proposal.md' }),
    readDocument({ path: paths.getSpecFilePath(specId), name: 'spec.md' }),
    ...((await pathExists(paths.getDesignFilePath(specId)))
      ? [readDocument({ path: paths.getDesignFilePath(specId), name: 'design.md' })]
      : []),
  ]);

  const handoffs = await collectHandoffs(paths.getHandoffsPath(specId));

  const evaluationPaths = EVALUATION_FILES.map((name) =>
    relative(paths.getProjectRoot(), join(paths.getSpecPath(specId), 'spec-score', name))
      .split(sep)
      .join('/'),
  );

  const trackedDiff = await git({
    pi,
    paths,
    signal,
    args: [
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      'HEAD',
      '--',
      '.',
      ...evaluationPaths.map((path) => `:(exclude,literal)${path}`),
    ],
  });

  const untrackedNames = (
    await git({ pi, paths, signal, args: ['ls-files', '--others', '--exclude-standard', '-z'] })
  )
    .split('\0')
    .filter((name) => name !== '' && !evaluationPaths.includes(name));

  const untrackedFiles = [];

  for (const name of untrackedNames) {
    untrackedFiles.push({
      name,
      diff: await git({
        pi,
        paths,
        signal,
        args: ['diff', '--no-index', '--no-ext-diff', '--no-textconv', '--', '/dev/null', name],
        allowedCodes: [0, 1],
      }),
    });
  }

  return { documents, handoffs, trackedDiff, untrackedFiles };
};
