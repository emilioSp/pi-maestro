import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { runGitCommand } from '#git/command.ts';
import { type GetMaestroPaths, getMaestroPaths } from '#paths.ts';
import { createSpec } from '#specs/create.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';

export const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');
export const SPEC_ID = '20260321-143052-add-weather-alerts';

const cleanupFunctions: Array<() => Promise<void>> = [];

type CreateApprovedWorkflowInput = {
  commitApproval?: boolean;
  specDirectory?: string;
  worktreeDirectory?: string;
};

export const createApprovedWorkflow = async ({
  commitApproval = true,
  specDirectory = '.specs',
  worktreeDirectory = '.worktree',
}: CreateApprovedWorkflowInput = {}) => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
  const configDirectory = join(repository.path, '.pi');
  await mkdir(configDirectory, { recursive: true });
  await writeFile(
    join(configDirectory, 'maestro.json'),
    JSON.stringify(
      {
        version: DEFAULT_CONFIG.version,
        specDirectory,
        worktreeDirectory,
      },
      null,
      2,
    ),
    'utf8',
  );
  await repository.commit({ message: 'Initial commit' });

  const config = await loadConfiguration({ cwd: repository.path });
  const paths = getMaestroPaths({
    repositoryRoot: repository.path,
    config,
  });
  await createSpec({
    paths,
    title: 'Add Weather Alerts',
    baseBranch: 'main',
    activeWorkflowSpecId: null,
    instant: INSTANT,
  });
  await markSpecReady({
    paths,
    specId: SPEC_ID,
    activeWorkflowSpecId: SPEC_ID,
  });

  if (commitApproval) {
    await repository.commit({ message: 'Approve builder spec' });
  }

  return {
    paths,
    repository,
    builderBranch: paths.getBuilderBranch(SPEC_ID),
    builderWorktreePath: paths.getBuilderWorktreePath(SPEC_ID),
  };
};

export const getBuilderWorktreePaths = async ({
  worktreePath,
}: {
  worktreePath: string;
}) => {
  const config = await loadConfiguration({ cwd: worktreePath });

  return getMaestroPaths({ repositoryRoot: worktreePath, config });
};

export const cleanupBuilderWorkflows = async (): Promise<void> => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
};

type BuilderWorkflowPathInput = {
  paths: GetMaestroPaths;
  worktreePath: string;
};

export const builderWorkflowPath = ({
  paths,
  worktreePath,
}: BuilderWorkflowPathInput): string =>
  paths.getWorkflowPathInWorktree({ specId: SPEC_ID, worktreePath });

export const builderHandoffPath = ({
  paths,
  worktreePath,
}: BuilderWorkflowPathInput): string =>
  paths.getBuilderHandoffPathInWorktree({ specId: SPEC_ID, worktreePath });

export const commitAll = async ({
  path,
  message,
}: {
  path: string;
  message: string;
}): Promise<void> => {
  await runGitCommand({ arguments: ['add', '--all'], cwd: path });
  await runGitCommand({
    arguments: ['commit', '--message', message],
    cwd: path,
  });
};

export const doneHandoff = (revision: number): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision,
  status: BUILDER_HANDOFF_STATUSES.DONE,
  summary: 'Implemented the approved change.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test',
      probeStatus: PROBE_STATUSES.PASSED,
      breakageStatus: BREAKAGE_STATUSES.CONFIRMED,
    },
  ],
  notes: [],
});

export const failedHandoff = (revision: number): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision,
  status: BUILDER_HANDOFF_STATUSES.FAILED,
  summary: 'The builder could not complete the approved change.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test',
      probeStatus: PROBE_STATUSES.NOT_RUN,
      breakageStatus: PROBE_STATUSES.NOT_RUN,
    },
  ],
  failure: { reason: 'The implementation was blocked.' },
  notes: [],
});
