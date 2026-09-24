import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { createBranch } from '#git/branches/createBranch.ts';
import { createWorktree } from '#git/worktrees/createWorktree.ts';
import {
  type GetMaestroPaths,
  getMaestroPaths,
  WORKFLOW_ROLES,
} from '#paths.ts';
import { commitAll } from '#test/support/builder-workflow.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { discoverActiveWorkflow } from '#workflow/state/discover.ts';
import { reconcileWorkflow } from '#workflow/state/reconcile.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowState,
} from '#workflow/state/schema.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];
const specId = '20260321-143052-add-weather-alerts';

const state = (phase: WorkflowState['phase']): WorkflowState => ({
  version: WORKFLOW_STATE_VERSION,
  specId,
  revision: 1,
  phase,
  baseBranch: 'main',
});

const createRepository = async () => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
  await repository.commit({ message: 'Initial commit' });
  const paths = getMaestroPaths({
    repositoryRoot: repository.path,
    config: {
      ...DEFAULT_CONFIG,
      specDirectory: join(repository.path, '.specs'),
      worktreeDirectory: join(repository.path, '.worktree'),
    },
  });

  return { repository, paths };
};

const writeState = async ({
  paths,
  workflowState,
}: {
  paths: GetMaestroPaths;
  workflowState: WorkflowState;
}): Promise<void> => {
  await mkdir(paths.getSpecPath(specId), { recursive: true });
  await writeFile(
    paths.getWorkflowPath(specId),
    `${JSON.stringify(workflowState)}\n`,
    'utf8',
  );
};

const createBuilderWorktree = async ({
  repositoryRoot,
  paths,
  branch = paths.getBuilderBranch(specId),
}: {
  repositoryRoot: string;
  paths: GetMaestroPaths;
  branch?: string;
}): Promise<void> => {
  await createBranch({ repositoryRoot, branch, startPoint: 'main' });
  await createWorktree({
    repositoryRoot,
    path: paths.getBuilderWorktreePath(specId),
    branch,
  });
};

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('workflow discovery and reconciliation', () => {
  it('finds no active workflow when the spec directory is absent', async () => {
    const { paths } = await createRepository();

    await expect(discoverActiveWorkflow({ paths })).resolves.toBeNull();
  });

  it('finds one active workflow and ignores a concluded workflow', async () => {
    const { paths } = await createRepository();
    await writeState({
      paths,
      workflowState: state(WORKFLOW_PHASES.READY_FOR_BUILDER),
    });

    await expect(discoverActiveWorkflow({ paths })).resolves.toMatchObject({
      specId,
      state: { phase: WORKFLOW_PHASES.READY_FOR_BUILDER },
    });

    await writeState({
      paths,
      workflowState: state(WORKFLOW_PHASES.FINAL_REVIEW),
    });
    await expect(discoverActiveWorkflow({ paths })).resolves.toBeNull();
  });

  it('reports a missing builder handoff', async () => {
    const { repository, paths } = await createRepository();
    const workflowState = state(WORKFLOW_PHASES.READY_FOR_VERIFIER);
    await writeState({ paths, workflowState });
    await createBuilderWorktree({ repositoryRoot: repository.path, paths });

    await expect(
      reconcileWorkflow({ paths, state: workflowState }),
    ).resolves.toMatchObject({
      role: WORKFLOW_ROLES.BUILDER,
      issues: ['Builder handoff is missing or invalid.'],
    });
  });

  it('reports a worktree on the wrong builder branch', async () => {
    const { repository, paths } = await createRepository();
    const workflowState = state(WORKFLOW_PHASES.BUILDER_RUNNING);
    await writeState({ paths, workflowState });
    await createBuilderWorktree({
      repositoryRoot: repository.path,
      paths,
      branch: 'wrong-branch',
    });

    await expect(
      reconcileWorkflow({ paths, state: workflowState }),
    ).resolves.toMatchObject({
      interrupted: true,
      issues: [
        `Expected builder branch is missing: ${paths.getBuilderBranch(specId)}.`,
      ],
    });
  });

  it('selects the verifier worktree whose workflow revision is current', async () => {
    const { repository, paths } = await createRepository();
    const firstState = state(WORKFLOW_PHASES.VERIFIER_RUNNING);
    await writeState({ paths, workflowState: firstState });
    await repository.commit({ message: 'Persist verifier workflow state' });

    const firstBranch = paths.getVerifierBranch({ specId, pass: 1 });
    const firstWorktreePath = paths.getVerifierWorktreePath({
      specId,
      pass: 1,
    });
    await createBranch({
      repositoryRoot: repository.path,
      branch: firstBranch,
      startPoint: 'main',
    });
    await createWorktree({
      repositoryRoot: repository.path,
      path: firstWorktreePath,
      branch: firstBranch,
    });

    const secondBranch = paths.getVerifierBranch({ specId, pass: 2 });
    const secondWorktreePath = paths.getVerifierWorktreePath({
      specId,
      pass: 2,
    });
    await createBranch({
      repositoryRoot: repository.path,
      branch: secondBranch,
      startPoint: 'main',
    });
    await createWorktree({
      repositoryRoot: repository.path,
      path: secondWorktreePath,
      branch: secondBranch,
    });
    const currentState = { ...firstState, revision: firstState.revision + 1 };
    await writeFile(
      paths.getWorkflowPathInWorktree({
        specId,
        worktreePath: secondWorktreePath,
      }),
      `${JSON.stringify(currentState)}\n`,
      'utf8',
    );
    await commitAll({
      path: secondWorktreePath,
      message: 'Start verifier pass 2',
    });

    await expect(
      reconcileWorkflow({ paths, state: currentState }),
    ).resolves.toMatchObject({
      branch: secondBranch,
      worktreePath: secondWorktreePath,
      head: expect.any(String),
      issues: [],
    });
  });

  it('identifies an interrupted clean builder pass', async () => {
    const { repository, paths } = await createRepository();
    const workflowState = state(WORKFLOW_PHASES.BUILDER_RUNNING);
    await writeState({ paths, workflowState });
    await createBuilderWorktree({ repositoryRoot: repository.path, paths });

    await expect(
      reconcileWorkflow({ paths, state: workflowState }),
    ).resolves.toMatchObject({
      role: WORKFLOW_ROLES.BUILDER,
      branch: paths.getBuilderBranch(specId),
      interrupted: true,
      dirty: false,
      issues: [],
    });
  });

  it('identifies an interrupted dirty builder pass', async () => {
    const { repository, paths } = await createRepository();
    const workflowState = state(WORKFLOW_PHASES.BUILDER_RUNNING);
    await writeState({ paths, workflowState });
    await createBuilderWorktree({ repositoryRoot: repository.path, paths });
    await writeFile(
      join(paths.getBuilderWorktreePath(specId), 'dirty.txt'),
      'dirty\n',
      'utf8',
    );

    await expect(
      reconcileWorkflow({ paths, state: workflowState }),
    ).resolves.toMatchObject({
      interrupted: true,
      dirty: true,
      issues: ['Expected builder worktree is dirty.'],
    });
  });
});
