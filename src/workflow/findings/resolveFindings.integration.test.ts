import { afterEach, describe, expect, it } from 'vitest';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
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
  it('records owner code-fix decisions on the same branch without merging', async () => {
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
      candidateCommit: verifierLaunch.candidateCommit,
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        revision: verifierLaunch.revision + 1,
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

    expect(resolved.repositoryRoot).toBe(repository.path);
    expect(resolved.state.phase).toBe(WORKFLOW_PHASES.READY_FOR_BUILDER);
    expect(resolved.findings[0].rejection).toBeNull();
    await expect(
      getCurrentBranch({ repositoryRoot: repository.path }),
    ).resolves.toBe('main');
  });
});
