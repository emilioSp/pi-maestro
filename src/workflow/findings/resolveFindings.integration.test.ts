import { afterEach, describe, expect, it } from 'vitest';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import {
  FINDING_DECISIONS,
  resolveFindings,
} from '#workflow/findings/resolveFindings.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

afterEach(cleanupBuilderWorkflows);

describe('finding resolution', () => {
  it('runs the code-fix cycle on the same checkout and branch', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const firstBuilderLaunch = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });
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

    const firstVerifierLaunch = await prepareVerifierLaunch({
      paths,
      specId: SPEC_ID,
    });
    const finding = {
      id: 'F1',
      acceptanceCriterion: null,
      severity: 'medium' as const,
      confidence: 0.9,
      summary: 'The implementation misses an edge case.',
      evidence: [
        {
          source: 'src/example.ts',
          observation: 'The edge case is not handled.',
        },
      ],
      rejection: null,
    };

    await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      candidateCommit: firstVerifierLaunch.candidateCommit,
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        revision: firstVerifierLaunch.revision + 1,
        summary: 'The candidate has one finding.',
        acceptanceCriteria: [],
        findings: [finding],
        notes: [],
      },
    });
    await commitAll({ path: repository.path, message: 'Verifier finding' });

    const resolved = await resolveFindings({
      paths,
      specId: SPEC_ID,
      decisions: [
        {
          findingId: finding.id,
          decision: FINDING_DECISIONS.FIX_CODE,
        },
      ],
    });

    expect(firstBuilderLaunch.specId).toBe(SPEC_ID);
    expect(firstVerifierLaunch.specId).toBe(SPEC_ID);
    expect(resolved.repositoryRoot).toBe(repository.path);
    expect(resolved.state.phase).toBe(WORKFLOW_PHASES.READY_FOR_BUILDER);
    expect(resolved.findings[0].rejection).toBeNull();

    const secondBuilderLaunch = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });
    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: 'done',
        summary: 'Fixed the reported finding.',
        acceptanceCriteria: [],
        notes: [],
      },
    });
    await commitAll({
      path: repository.path,
      message: 'Builder fixed finding',
    });

    const secondCandidateCommit = await getHeadCommit({
      repositoryRoot: repository.path,
    });
    const secondVerifierLaunch = await prepareVerifierLaunch({
      paths,
      specId: SPEC_ID,
    });

    expect(secondBuilderLaunch.specId).toBe(SPEC_ID);
    expect(secondVerifierLaunch.specId).toBe(SPEC_ID);
    expect(secondVerifierLaunch.candidateCommit).toBe(secondCandidateCommit);
    expect(secondVerifierLaunch.repositoryRoot).toBe(repository.path);

    const secondVerifier = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      candidateCommit: secondVerifierLaunch.candidateCommit,
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        revision: secondVerifierLaunch.revision + 1,
        summary: 'The corrected candidate is approved.',
        acceptanceCriteria: [],
        findings: [],
        notes: [],
      },
    });
    expect('state' in secondVerifier).toBe(true);

    if (!('state' in secondVerifier)) {
      throw new Error('Expected the second verifier pass to succeed.');
    }

    await commitAll({
      path: repository.path,
      message: 'Verifier approved fix',
    });

    expect(secondVerifier.state.phase).toBe(WORKFLOW_PHASES.CANDIDATE_READY);
    await expect(
      readVerifierHandoff({
        path: paths.getVerifierHandoffPath(SPEC_ID),
        specId: SPEC_ID,
        revision: secondVerifier.state.revision,
      }),
    ).resolves.toMatchObject({
      specId: SPEC_ID,
      revision: secondVerifier.state.revision,
      findings: [],
    });
    await expect(
      getCurrentBranch({ repositoryRoot: repository.path }),
    ).resolves.toBe('main');
  });
});
