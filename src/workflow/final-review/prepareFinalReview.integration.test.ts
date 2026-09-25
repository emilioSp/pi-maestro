import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  VERIFIER_HANDOFF_VERSION,
  type VerifierHandoff,
} from '#artifacts/verifier-handoff/schema.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  doneHandoff,
  getBuilderWorktreePaths,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { prepareFinalReview } from '#workflow/final-review/prepareFinalReview.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

afterEach(cleanupBuilderWorkflows);

const approvedVerifierHandoff = (revision: number): VerifierHandoff => ({
  version: VERIFIER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision,
  summary: 'All candidate checks passed.',
  acceptanceCriteria: [],
  findings: [],
  notes: [],
});

describe('final review preparation', () => {
  it('allows the managed worktree directory to remain untracked in the base repository', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const builderLaunch = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });

    await writeFile(join(builderWorktreePath, 'product.txt'), 'candidate\n');

    const builderPaths = await getBuilderWorktreePaths({
      worktreePath: builderWorktreePath,
    });
    await completeBuilderPass({
      paths: builderPaths,
      specId: SPEC_ID,
      handoff: doneHandoff(builderLaunch.revision + 1),
    });
    await commitAll({
      path: builderWorktreePath,
      message: 'Builder candidate',
    });

    const verifierLaunch = await prepareVerifierLaunch({
      paths,
      specId: SPEC_ID,
    });
    await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      pass: verifierLaunch.pass,
      candidateCommit: verifierLaunch.candidateCommit,
      handoff: approvedVerifierHandoff(verifierLaunch.revision + 1),
    });
    await commitAll({
      path: verifierLaunch.worktreePath,
      message: 'Verifier approved',
    });

    const result = await prepareFinalReview({
      paths,
      specId: SPEC_ID,
      pass: verifierLaunch.pass,
    });

    expect(result.stagedPaths).toContain('product.txt');
    expect(result.cleanup.failures).toEqual([]);
    expect(result.cleanup.removed).toEqual(
      expect.arrayContaining([
        paths.getBuilderBranch(SPEC_ID),
        paths.getVerifierBranch({
          specId: SPEC_ID,
          pass: verifierLaunch.pass,
        }),
      ]),
    );
  });
});
