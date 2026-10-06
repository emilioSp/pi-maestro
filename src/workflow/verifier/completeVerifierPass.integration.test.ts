import { access, readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

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

  const builderRun = await prepareBuilderRun({
    paths: workflow.paths,
    specId: SPEC_ID,
  });

  await completeBuilderPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: {
      status: BUILDER_HANDOFF_STATUSES.DONE,
      summary: 'Implemented the approved change.',
      acceptanceCriteria: [],
      notes: [],
    },
  });
  await workflow.repository.commit('Builder completed');

  const verifierRun = await prepareVerifierRun({
    paths: workflow.paths,
    specId: SPEC_ID,
  });

  return { ...workflow, builderRun, verifierRun };
};

describe('verifier completion', () => {
  it('writes one verifier handoff on the current checkout', async () => {
    const { paths, repository, verifierRun } = await prepareRunningVerifier();

    const handoff = {
      ...approvedHandoff,
      revision: verifierRun.revision + 1,
    };

    const completed = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      handoff,
    });

    expect(completed.repositoryRoot).toBe(repository.path);
    expect(completed.state.phase).toBe(WORKFLOW_PHASES.CANDIDATE_READY);
    await expect(getRepositoryStatus(repository.path)).resolves.toMatchObject({
      staged: [],
      unstaged: [relative(repository.path, paths.getWorkflowPath(SPEC_ID))],
      untracked: [
        relative(repository.path, paths.getVerifierHandoffPath(SPEC_ID)),
      ],
    });
    await repository.commit('Verifier completed');
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
  });

  it('given an invalid handoff specId when the verifier submits it then no protocol write occurs', async () => {
    const { paths, verifierRun } = await prepareRunningVerifier();
    const workflowPath = paths.getWorkflowPath(SPEC_ID);
    const workflowBefore = await readFile(workflowPath, 'utf8');

    await expect(
      completeVerifierPass({
        paths,
        specId: SPEC_ID,
        handoff: {
          ...approvedHandoff,
          revision: verifierRun.revision + 1,
          specId: '20260321-143052-other-spec',
        },
      }),
    ).rejects.toThrow('Verifier handoff spec ID mismatch');

    await expect(readFile(workflowPath, 'utf8')).resolves.toBe(workflowBefore);
    await expect(
      access(paths.getVerifierHandoffPath(SPEC_ID)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('given an invalid handoff revision when the verifier submits it then no protocol write occurs', async () => {
    const { paths } = await prepareRunningVerifier();
    const workflowPath = paths.getWorkflowPath(SPEC_ID);
    const workflowBefore = await readFile(workflowPath, 'utf8');

    await expect(
      completeVerifierPass({
        paths,
        specId: SPEC_ID,
        handoff: {
          ...approvedHandoff,
          revision: 1,
        },
      }),
    ).rejects.toThrow('Verifier handoff revision mismatch');

    await expect(readFile(workflowPath, 'utf8')).resolves.toBe(workflowBefore);
    await expect(
      access(paths.getVerifierHandoffPath(SPEC_ID)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
