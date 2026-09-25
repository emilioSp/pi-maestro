import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import {
  completeVerifierPass,
  VERIFIER_PASS_ERRORS,
} from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

afterEach(cleanupBuilderWorkflows);

const approvedHandoff = {
  version: VERIFIER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision: 6,
  summary: 'The candidate satisfies the approved specification.',
  acceptanceCriteria: [],
  findings: [],
  notes: [],
};

const prepareRunningVerifier = async () => {
  const workflow = await createApprovedWorkflow();
  const builderLaunch = await prepareBuilderLaunch({
    paths: workflow.paths,
    specId: SPEC_ID,
  });
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

  return { ...workflow, builderLaunch, verifierLaunch };
};

describe('verifier completion', () => {
  it('writes one verifier handoff on the current checkout', async () => {
    const { paths, repository, verifierLaunch } =
      await prepareRunningVerifier();
    const handoff = {
      ...approvedHandoff,
      revision: verifierLaunch.revision + 1,
    };

    const completed = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      candidateCommit: verifierLaunch.candidateCommit,
      handoff,
    });

    expect('state' in completed).toBe(true);

    if (!('state' in completed)) {
      throw new Error('Expected verifier completion to succeed.');
    }

    expect(completed.repositoryRoot).toBe(repository.path);
    expect(completed.state.phase).toBe(WORKFLOW_PHASES.CANDIDATE_READY);
    await commitAll({ path: repository.path, message: 'Verifier completed' });
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
  });

  it('rejects product changes without writing the verifier protocol', async () => {
    const { paths, repository, verifierLaunch } =
      await prepareRunningVerifier();
    await writeFile(join(repository.path, 'product-change.txt'), 'changed\n');
    const handoffPath = paths.getVerifierHandoffPath(SPEC_ID);

    await expect(
      completeVerifierPass({
        paths,
        specId: SPEC_ID,
        candidateCommit: verifierLaunch.candidateCommit,
        handoff: {
          ...approvedHandoff,
          revision: verifierLaunch.revision + 1,
        },
      }),
    ).resolves.toEqual({
      error: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
      message:
        'Product files differ from the candidate commit. Restore the candidate before submitting the verifier handoff.',
    });
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.VERIFIER_RUNNING });
    await expect(
      import('node:fs/promises').then(({ access }) => access(handoffPath)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
