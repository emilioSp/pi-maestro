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
import { prepareFinalReview } from '#workflow/final-review/prepareFinalReview.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

afterEach(cleanupBuilderWorkflows);

describe('final review', () => {
  it('commits final-review state on the current branch without staging or squash', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: 'done',
        summary: 'Implemented the approved change.',
        acceptanceCriteria: [],
        notes: [],
      },
    });
    await commitAll({ path: repository.path, message: 'Builder completed' });
    const verifierLaunch = await prepareVerifierLaunch({
      paths,
      specId: SPEC_ID,
    });
    await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      candidateCommit: verifierLaunch.candidateCommit,
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        revision: verifierLaunch.revision + 1,
        summary: 'The candidate is approved.',
        acceptanceCriteria: [],
        findings: [],
        notes: [],
      },
    });
    await commitAll({ path: repository.path, message: 'Verifier completed' });

    const result = await prepareFinalReview({ paths, specId: SPEC_ID });

    expect(result).toMatchObject({
      currentBranch: 'main',
      phase: WORKFLOW_PHASES.FINAL_REVIEW,
    });
    expect(result.candidateCommit).not.toBe(result.finalReviewCommit);
    expect(result.pullRequestGuidance).toContain('Pull Request');
  });
});
