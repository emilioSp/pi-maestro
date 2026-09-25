import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { prepareFinalReview } from '#workflow/final-review/prepareFinalReview.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

afterEach(cleanupBuilderWorkflows);

const prepareCandidate = async () => {
  const workflow = await createApprovedWorkflow();
  await prepareBuilderLaunch({ paths: workflow.paths, specId: SPEC_ID });
  await completeBuilderPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: {
      status: 'done',
      summary: 'Implemented the approved change.',
      acceptanceCriteria: [],
      notes: [],
    },
  });
  await commitAll({
    path: workflow.repository.path,
    message: 'Builder completed',
  });

  const verifierLaunch = await prepareVerifierLaunch({
    paths: workflow.paths,
    specId: SPEC_ID,
  });
  const verifierRevision = verifierLaunch.revision + 1;
  await completeVerifierPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    candidateCommit: verifierLaunch.candidateCommit,
    handoff: {
      version: VERIFIER_HANDOFF_VERSION,
      specId: SPEC_ID,
      revision: verifierRevision,
      summary: 'The candidate is approved.',
      acceptanceCriteria: [],
      findings: [],
      notes: [],
    },
  });
  await commitAll({
    path: workflow.repository.path,
    message: 'Verifier completed',
  });

  return {
    ...workflow,
    candidateCommit: await getHeadCommit({
      repositoryRoot: workflow.repository.path,
    }),
    verifierRevision,
  };
};

describe('final review', () => {
  it('commits final-review and returns Pull Request facts', async () => {
    const { paths, repository, candidateCommit } = await prepareCandidate();

    const result = await prepareFinalReview({ paths, specId: SPEC_ID });

    expect(result).toMatchObject({
      currentBranch: 'main',
      candidateCommit,
      phase: WORKFLOW_PHASES.FINAL_REVIEW,
    });
    expect(result.finalReviewCommit).not.toBe(candidateCommit);
    expect(result.pullRequestGuidance).not.toBe('');

    await expect(
      getRepositoryStatus({ repositoryRoot: repository.path }),
    ).resolves.toMatchObject({ clean: true });
    await expect(
      runGitCommand({
        arguments: [
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          result.finalReviewCommit,
        ],
        cwd: repository.path,
      }),
    ).resolves.toMatchObject({
      stdout: `${relative(repository.path, paths.getWorkflowPath(SPEC_ID))}\n`,
    });

    await expect(
      prepareFinalReview({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('Final review requires candidate-ready state');
  });

  it('rejects active verifier findings', async () => {
    const { paths, repository, verifierRevision } = await prepareCandidate();
    const activeFinding = {
      id: 'F1',
      acceptanceCriterion: null,
      severity: 'medium' as const,
      confidence: 0.9,
      summary: 'The candidate misses an edge case.',
      evidence: [
        {
          source: 'src/example.ts',
          observation: 'The edge case is not handled.',
        },
      ],
      rejection: null,
    };

    await writeJsonAtomically({
      path: paths.getVerifierHandoffPath(SPEC_ID),
      data: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        revision: verifierRevision,
        summary: 'The candidate has an active finding.',
        acceptanceCriteria: [],
        findings: [activeFinding],
        notes: [],
      },
    });
    await commitAll({
      path: repository.path,
      message: 'Restore active verifier finding',
    });

    await expect(
      prepareFinalReview({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('findings that were not rejected');
  });

  it('rejects a dirty checkout without changing workflow state', async () => {
    const { paths, repository } = await prepareCandidate();
    await writeFile(join(repository.path, 'owner-change.txt'), 'dirty\n');

    await expect(
      prepareFinalReview({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('clean current checkout');
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
  });
});
