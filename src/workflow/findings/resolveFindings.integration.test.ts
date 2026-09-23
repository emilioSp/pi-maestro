import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
  type VerifierHandoff,
} from '#artifacts/verifier-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import {
  FINDING_DECISIONS,
  resolveFindings,
} from '#workflow/findings/resolveFindings.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

afterEach(cleanupBuilderWorkflows);

const prepareFindings = async (count = 2) => {
  const { paths, builderWorktreePath } = await createApprovedWorkflow();
  const builderLaunch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
  await completeBuilderPass({
    paths,
    specId: SPEC_ID,
    handoff: doneHandoff(builderLaunch.revision + 1),
  });
  await commitAll({ path: builderWorktreePath, message: 'Builder candidate' });
  const candidateCommit = await getHeadCommit({
    repositoryRoot: builderWorktreePath,
  });
  const launch = await prepareVerifierLaunch({ paths, specId: SPEC_ID });
  const handoff: VerifierHandoff = {
    version: VERIFIER_HANDOFF_VERSION,
    specId: SPEC_ID,
    revision: launch.revision + 1,
    summary: 'Independent verification found issues.',
    acceptanceCriteria: [],
    findings: Array.from({ length: count }, (_, index) => ({
      id: `F${index + 1}`,
      acceptanceCriterion: null,
      severity: FINDING_SEVERITIES.MEDIUM,
      confidence: 0.9,
      summary: `Finding ${index + 1}`,
      evidence: [{ source: 'test', observation: 'The probe failed.' }],
      rejection: null,
    })),
    notes: [],
  };
  await completeVerifierPass({
    paths,
    specId: SPEC_ID,
    pass: launch.pass,
    candidateCommit,
    handoff,
  });
  return { paths, builderWorktreePath, launch, handoff };
};

const decisionsForAllReject = [
  {
    findingId: 'F1',
    decision: FINDING_DECISIONS.REJECT,
    reason: 'The evidence does not prove a contract violation.',
  },
  {
    findingId: 'F2',
    decision: FINDING_DECISIONS.REJECT,
    reason: 'The behavior is acceptable.',
  },
] as const;

describe('resolveFindings', () => {
  it.each([
    {
      name: 'all rejected findings become candidate-ready',
      decisions: decisionsForAllReject,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      rejected: [true, true],
      message: 'candidate-ready',
    },
    {
      name: 'a fix-code decision keeps valid findings unrejected',
      decisions: [
        {
          findingId: 'F1',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'No contract violation.',
        },
        { findingId: 'F2', decision: FINDING_DECISIONS.FIX_CODE },
      ],
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      rejected: [true, false],
      message: 'ready-for-builder',
    },
  ])('$name', async ({ decisions, phase, rejected, message }) => {
    const { paths, launch, handoff } = await prepareFindings();
    const result = await resolveFindings({
      paths,
      specId: SPEC_ID,
      pass: launch.pass,
      decisions: [...decisions],
    });
    expect(result.state.phase).toBe(phase);
    expect(result.findings.map(({ rejection }) => rejection !== null)).toEqual(
      rejected,
    );
    const stored = await readVerifierHandoff({
      path: paths.getVerifierHandoffPathInWorktree({
        specId: SPEC_ID,
        worktreePath: paths.getVerifierWorktreePath({
          specId: SPEC_ID,
          pass: launch.pass,
        }),
      }),
      specId: SPEC_ID,
      revision: result.state.revision,
    });
    expect(stored.findings.map(({ rejection }) => rejection !== null)).toEqual(
      rejected,
    );
    const commitMessage = await runGitCommand({
      arguments: ['log', '-1', '--format=%s'],
      cwd: paths.getVerifierWorktreePath({
        specId: SPEC_ID,
        pass: launch.pass,
      }),
    });
    expect(commitMessage.stdout.trim()).toBe(message);
    expect(handoff.findings.every(({ rejection }) => rejection === null)).toBe(
      true,
    );
  });

  // [name, decision, error message]
  it.each([
    [
      'missing finding decision (F2 is missing)',
      [
        {
          findingId: 'F1',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'No issue.',
        },
      ],
      'Missing decision',
    ],
    [
      'duplicate finding decision',
      [
        decisionsForAllReject[0],
        decisionsForAllReject[0],
        decisionsForAllReject[1],
      ],
      'Duplicate decision',
    ],
    [
      'unknown finding ID -- F3',
      [
        {
          findingId: 'F1',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'No issue.',
        },
        {
          findingId: 'F3',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'No issue.',
        },
      ],
      'Unknown finding ID',
    ],
    [
      'empty rejection reason',
      [
        { findingId: 'F1', decision: FINDING_DECISIONS.REJECT, reason: '  ' },
        {
          findingId: 'F2',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'No issue.',
        },
      ],
      'must not be empty',
    ],
  ])(
    'rejects %s without partial mutation',
    async (_name, decisions, message) => {
      const { paths, launch } = await prepareFindings();
      const verifierPath = paths.getVerifierWorktreePath({
        specId: SPEC_ID,
        pass: launch.pass,
      });
      const beforeHandoff = await readFile(
        paths.getVerifierHandoffPathInWorktree({
          specId: SPEC_ID,
          worktreePath: verifierPath,
        }),
        'utf8',
      );
      const beforeState = await readFile(
        paths.getWorkflowPathInWorktree({
          specId: SPEC_ID,
          worktreePath: verifierPath,
        }),
        'utf8',
      );
      const beforeHead = await getHeadCommit({ repositoryRoot: verifierPath });
      await expect(
        resolveFindings({
          paths,
          specId: SPEC_ID,
          pass: launch.pass,
          decisions: decisions as never,
        }),
      ).rejects.toThrow(message as string);
      expect(
        await readFile(
          paths.getVerifierHandoffPathInWorktree({
            specId: SPEC_ID,
            worktreePath: verifierPath,
          }),
          'utf8',
        ),
      ).toBe(beforeHandoff);
      expect(
        await readFile(
          paths.getWorkflowPathInWorktree({
            specId: SPEC_ID,
            worktreePath: verifierPath,
          }),
          'utf8',
        ),
      ).toBe(beforeState);
      expect(await getHeadCommit({ repositoryRoot: verifierPath })).toBe(
        beforeHead,
      );
    },
  );

  it('does not mutate findings when the branch cannot fast-forward', async () => {
    const { paths, launch, builderWorktreePath } = await prepareFindings();
    await writeFile(join(builderWorktreePath, 'divergent.txt'), 'divergence\n');
    await commitAll({
      path: builderWorktreePath,
      message: 'Diverge builder branch',
    });
    const verifierPath = paths.getVerifierWorktreePath({
      specId: SPEC_ID,
      pass: launch.pass,
    });
    const before = await readFile(
      paths.getVerifierHandoffPathInWorktree({
        specId: SPEC_ID,
        worktreePath: verifierPath,
      }),
      'utf8',
    );
    await expect(
      resolveFindings({
        paths,
        specId: SPEC_ID,
        pass: launch.pass,
        decisions: [...decisionsForAllReject],
      }),
    ).rejects.toThrow();
    expect(
      await readFile(
        paths.getVerifierHandoffPathInWorktree({
          specId: SPEC_ID,
          worktreePath: verifierPath,
        }),
        'utf8',
      ),
    ).toBe(before);
    expect(
      (
        await readWorkflowState({
          path: paths.getWorkflowPathInWorktree({
            specId: SPEC_ID,
            worktreePath: verifierPath,
          }),
        })
      ).phase,
    ).toBe(WORKFLOW_PHASES.FINDINGS_DECISION);
  });
});
