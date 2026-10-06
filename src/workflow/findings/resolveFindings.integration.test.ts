import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
} from '#artifacts/verifier-handoff/schema.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import {
  FINDING_DECISIONS,
  resolveFindings,
} from '#workflow/findings/resolveFindings.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

afterEach(cleanupBuilderWorkflows);

describe('finding resolution', () => {
  it('runs the code-fix cycle on the same checkout and branch', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const firstBuilderRun = await prepareBuilderRun({
      paths,
      specId: SPEC_ID,
    });

    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: BUILDER_HANDOFF_STATUSES.DONE,
        summary: 'Implemented the approved change.',
        acceptanceCriteria: [],
        notes: [],
      },
    });
    await repository.commit('Builder completed');

    const firstVerifierRun = await prepareVerifierRun({
      paths,
      specId: SPEC_ID,
    });

    const finding = {
      id: 'F1',
      acceptanceCriterion: null,
      severity: FINDING_SEVERITIES.MEDIUM,
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
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        revision: firstVerifierRun.revision + 1,
        summary: 'The candidate has one finding.',
        acceptanceCriteria: [],
        findings: [finding],
        notes: [],
      },
    });
    await repository.commit('Verifier finding');

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

    expect(firstBuilderRun.specId).toBe(SPEC_ID);
    expect(firstVerifierRun.specId).toBe(SPEC_ID);
    expect(resolved.repositoryRoot).toBe(repository.path);
    expect(resolved.state.phase).toBe(WORKFLOW_PHASES.READY_FOR_BUILDER);
    expect(resolved.findings[0].rejection).toBeNull();

    const secondBuilderRun = await prepareBuilderRun({
      paths,
      specId: SPEC_ID,
    });

    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: BUILDER_HANDOFF_STATUSES.DONE,
        summary: 'Fixed the reported finding.',
        acceptanceCriteria: [],
        notes: [],
      },
    });
    await repository.commit('Builder fixed finding');

    const secondVerifierRun = await prepareVerifierRun({
      paths,
      specId: SPEC_ID,
    });

    expect(secondBuilderRun.specId).toBe(SPEC_ID);
    expect(secondVerifierRun.specId).toBe(SPEC_ID);
    expect(secondVerifierRun.candidateCommit).toBe(
      secondVerifierRun.checkpointCommit,
    );
    await expect(getHeadCommit(repository.path)).resolves.toBe(
      secondVerifierRun.candidateCommit,
    );
    expect(secondVerifierRun.repositoryRoot).toBe(repository.path);

    const secondVerifier = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        revision: secondVerifierRun.revision + 1,
        summary: 'The corrected candidate is approved.',
        acceptanceCriteria: [],
        findings: [],
        notes: [],
      },
    });

    await repository.commit('Verifier approved fix');

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
    await expect(getCurrentBranch(repository.path)).resolves.toBe('main');
  });
});
