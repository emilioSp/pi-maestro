import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoffSubmission,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import {
  builderHandoffPath,
  builderWorkflowPath,
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  getBuilderWorktreePaths,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { pathExists } from '#utils/path-exists.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

const DONE_SUBMISSION: BuilderHandoffSubmission = {
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
};

const FAILED_SUBMISSION: BuilderHandoffSubmission = {
  status: BUILDER_HANDOFF_STATUSES.FAILED,
  summary: 'The builder could not complete the approved change.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test',
      probeStatus: PROBE_STATUSES.NOT_RUN,
      breakageStatus: BREAKAGE_STATUSES.NOT_RUN,
    },
  ],
  failure: { reason: 'The implementation was blocked.' },
  notes: [],
};

const PROTECTED_PATHS = [
  { label: 'spec', path: '.specs/SPEC_ID/spec.md' },
  { label: 'workflow state', path: '.specs/SPEC_ID/workflow.json' },
  { label: 'prototype', path: '.specs/SPEC_ID/prototypes/direct-edit.txt' },
  { label: 'handoff', path: '.specs/SPEC_ID/handoffs/direct-edit.json' },
] as const;

const createBuilderPass = async () => {
  const { paths, builderWorktreePath } = await createApprovedWorkflow();
  const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
  const builderPaths = await getBuilderWorktreePaths({
    worktreePath: builderWorktreePath,
  });

  return { paths: builderPaths, builderWorktreePath, launch };
};

describe('builder pass completion', () => {
  it('records a done handoff using identity and revision from workflow state', async () => {
    const { paths, builderWorktreePath, launch } = await createBuilderPass();
    await writeFile(join(builderWorktreePath, 'product.txt'), 'implemented\n');

    const completed = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: DONE_SUBMISSION,
    });

    expect(completed.handoff).toMatchObject({
      specId: SPEC_ID,
      revision: launch.revision + 1,
      status: BUILDER_HANDOFF_STATUSES.DONE,
    });
    expect(completed.state).toMatchObject({
      revision: launch.revision + 1,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    });

    await runGitCommand({
      arguments: ['add', '--all'],
      cwd: builderWorktreePath,
    });
    await runGitCommand({
      arguments: ['commit', '--message', 'Builder done'],
      cwd: builderWorktreePath,
    });

    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.READY_FOR_VERIFIER });
    await expect(
      pathExists(builderHandoffPath(builderWorktreePath)),
    ).resolves.toBe(true);
  });

  it('records a failed handoff and moves to builder-failed', async () => {
    const { paths, builderWorktreePath, launch } = await createBuilderPass();

    const completed = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: FAILED_SUBMISSION,
    });

    expect(completed.handoff).toMatchObject({
      specId: SPEC_ID,
      revision: launch.revision + 1,
      status: BUILDER_HANDOFF_STATUSES.FAILED,
      failure: FAILED_SUBMISSION.failure,
    });
    expect(completed.state).toMatchObject({
      revision: launch.revision + 1,
      phase: WORKFLOW_PHASES.BUILDER_FAILED,
    });

    await runGitCommand({
      arguments: ['add', '--all'],
      cwd: builderWorktreePath,
    });
    await runGitCommand({
      arguments: ['commit', '--message', 'Builder failed'],
      cwd: builderWorktreePath,
    });

    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_FAILED });
  });

  it('leaves handoff and state unchanged when final validation fails', async () => {
    const { paths, builderWorktreePath, launch } = await createBuilderPass();
    const invalidSubmission: BuilderHandoffSubmission = {
      ...DONE_SUBMISSION,
      acceptanceCriteria: [
        {
          id: 'AC1',
          probe: 'npm test',
          probeStatus: PROBE_STATUSES.FAILED,
          breakageStatus: BREAKAGE_STATUSES.NOT_CONFIRMED,
        },
      ],
    };

    await expect(
      completeBuilderPass({
        paths,
        specId: SPEC_ID,
        handoff: invalidSubmission,
      }),
    ).rejects.toThrow('Done builder handoff requires every probe to pass');

    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({
      revision: launch.revision,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
    await expect(
      pathExists(builderHandoffPath(builderWorktreePath)),
    ).resolves.toBe(false);
  });

  it.each(PROTECTED_PATHS)(
    'rejects a direct change to the protected $label path',
    async ({ path }) => {
      const { paths, builderWorktreePath } = await createBuilderPass();
      const targetPath = join(
        builderWorktreePath,
        path.replace('SPEC_ID', SPEC_ID),
      );
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, 'direct change\n');

      await expect(
        completeBuilderPass({
          paths,
          specId: SPEC_ID,
          handoff: DONE_SUBMISSION,
        }),
      ).rejects.toThrow(
        'Builder changed a protected workflow file after launch',
      );

      await expect(
        pathExists(builderHandoffPath(builderWorktreePath)),
      ).resolves.toBe(false);
    },
  );

  it('detects a staged protocol change even when the working file is restored', async () => {
    const { paths, builderWorktreePath } = await createBuilderPass();
    const specPath = join(builderWorktreePath, '.specs', SPEC_ID, 'spec.md');
    const originalSpec = await readFile(specPath, 'utf8');

    await writeFile(specPath, `${originalSpec}\nchanged\n`);
    await runGitCommand({
      arguments: ['add', '--', relative(builderWorktreePath, specPath)],
      cwd: builderWorktreePath,
    });
    await writeFile(specPath, originalSpec);

    await expect(
      completeBuilderPass({
        paths,
        specId: SPEC_ID,
        handoff: DONE_SUBMISSION,
      }),
    ).rejects.toThrow('Builder changed a protected workflow file after launch');
  });
});
