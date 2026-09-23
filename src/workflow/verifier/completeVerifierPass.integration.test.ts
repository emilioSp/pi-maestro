import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  type BreakageStatus,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
  type VerifierHandoff,
} from '#artifacts/verifier-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  builderWorkflowPath,
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { pathExists } from '#utils/path-exists.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { readWorkflowState } from '#workflow/state/store.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

afterEach(cleanupBuilderWorkflows);

const prepareVerifier = async () => {
  const { paths, builderWorktreePath } = await createApprovedWorkflow();
  const builderLaunch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
  await writeFile(join(builderWorktreePath, 'product.txt'), 'candidate\n');
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
  return { paths, launch, candidateCommit };
};

const emptyHandoff = (revision: number): VerifierHandoff => ({
  version: VERIFIER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision,
  summary: 'Regenerated the acceptance checks from the candidate.',
  acceptanceCriteria: [],
  findings: [],
  notes: [],
});

const findingHandoff = (
  revision: number,
  breakageStatus: BreakageStatus = BREAKAGE_STATUSES.CONFIRMED,
): VerifierHandoff => ({
  version: VERIFIER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision,
  summary: 'Found a behavior that needs owner review.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test',
      probeStatus: PROBE_STATUSES.PASSED,
      breakageStatus,
    },
  ],
  findings: [
    {
      id: 'F1',
      acceptanceCriterion: 'AC1',
      severity: FINDING_SEVERITIES.MEDIUM,
      confidence: 0.9,
      summary: 'The behavior does not match the approved contract.',
      evidence: [
        { source: 'test', observation: 'The independent probe failed.' },
      ],
      rejection: null,
    },
  ],
  notes: [],
});

describe('verifier pass completion', () => {
  it('moves an empty findings handoff to candidate-ready', async () => {
    const { paths, launch } = await prepareVerifier();

    const completed = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      pass: launch.pass,
      candidateCommit: launch.candidateCommit,
      handoff: emptyHandoff(launch.revision + 1),
    });

    expect(completed).toMatchObject({
      state: {
        revision: launch.revision + 1,
        phase: WORKFLOW_PHASES.CANDIDATE_READY,
      },
    });
  });

  it('moves findings to findings-decision', async () => {
    const { paths, launch } = await prepareVerifier();

    const completed = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      pass: launch.pass,
      candidateCommit: launch.candidateCommit,
      handoff: findingHandoff(launch.revision + 1),
    });

    expect(completed).toMatchObject({
      state: { phase: WORKFLOW_PHASES.FINDINGS_DECISION },
    });
  });

  it('allows findings to report remaining breakage', async () => {
    const { paths, launch } = await prepareVerifier();

    const completed = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      pass: launch.pass,
      candidateCommit: launch.candidateCommit,
      handoff: findingHandoff(
        launch.revision + 1,
        BREAKAGE_STATUSES.NOT_CONFIRMED,
      ),
    });

    expect(completed).toMatchObject({
      state: { phase: WORKFLOW_PHASES.FINDINGS_DECISION },
    });
  });

  it('rejects staged product changes without writing handoff or workflow state', async () => {
    const { paths, launch } = await prepareVerifier();
    const productPath = join(launch.worktreePath, 'product.txt');
    await writeFile(productPath, 'staged change\n');
    await runGitCommand({
      arguments: ['add', '--', 'product.txt'],
      cwd: launch.worktreePath,
    });
    await writeFile(productPath, 'candidate\n');

    await expect(
      completeVerifierPass({
        paths,
        specId: SPEC_ID,
        pass: launch.pass,
        candidateCommit: launch.candidateCommit,
        handoff: emptyHandoff(launch.revision + 1),
      }),
    ).resolves.toMatchObject({ error: 'PRODUCT_FILES_MODIFIED' });
    await expect(
      pathExists(
        join(
          launch.worktreePath,
          '.specs',
          SPEC_ID,
          'handoffs',
          'verifier.json',
        ),
      ),
    ).resolves.toBe(false);
    await expect(
      readWorkflowState({
        path: join(launch.worktreePath, '.specs', SPEC_ID, 'workflow.json'),
      }),
    ).resolves.toMatchObject({
      revision: launch.revision,
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });
  });

  it('rejects unstaged product changes without writing handoff or workflow state', async () => {
    const { paths, launch } = await prepareVerifier();
    await writeFile(
      join(launch.worktreePath, 'product.txt'),
      'unstaged change\n',
    );

    await expect(
      completeVerifierPass({
        paths,
        specId: SPEC_ID,
        pass: launch.pass,
        candidateCommit: launch.candidateCommit,
        handoff: emptyHandoff(launch.revision + 1),
      }),
    ).resolves.toMatchObject({ error: 'PRODUCT_FILES_MODIFIED' });
    await expect(
      pathExists(
        join(
          launch.worktreePath,
          '.specs',
          SPEC_ID,
          'handoffs',
          'verifier.json',
        ),
      ),
    ).resolves.toBe(false);
    await expect(
      readWorkflowState({
        path: join(launch.worktreePath, '.specs', SPEC_ID, 'workflow.json'),
      }),
    ).resolves.toMatchObject({
      revision: launch.revision,
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });
  });

  it('rejects untracked product files with a simple error shape and no writes', async () => {
    const { paths, launch } = await prepareVerifier();
    await writeFile(join(launch.worktreePath, 'new-product.txt'), 'new file\n');
    const workflowPath = join(
      launch.worktreePath,
      '.specs',
      SPEC_ID,
      'workflow.json',
    );
    const before = await readFile(workflowPath, 'utf8');

    const result = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      pass: launch.pass,
      candidateCommit: launch.candidateCommit,
      handoff: emptyHandoff(launch.revision + 1),
    });

    expect(result).toEqual({
      error: 'PRODUCT_FILES_MODIFIED',
      message:
        'Product files differ from the candidate commit. Restore the candidate before submitting the verifier handoff.',
    });
    expect(JSON.stringify(result)).not.toContain('new-product.txt');
    await expect(readFile(workflowPath, 'utf8')).resolves.toBe(before);
    await expect(
      pathExists(
        join(
          launch.worktreePath,
          '.specs',
          SPEC_ID,
          'handoffs',
          'verifier.json',
        ),
      ),
    ).resolves.toBe(false);
  });

  it('uses the same product-integrity check when findings are non-empty', async () => {
    const { paths, launch } = await prepareVerifier();
    await writeFile(join(launch.worktreePath, 'product.txt'), 'changed\n');

    await expect(
      completeVerifierPass({
        paths,
        specId: SPEC_ID,
        pass: launch.pass,
        candidateCommit: launch.candidateCommit,
        handoff: findingHandoff(launch.revision + 1),
      }),
    ).resolves.toMatchObject({ error: 'PRODUCT_FILES_MODIFIED' });
    await expect(
      readWorkflowState({
        path: builderWorkflowPath(
          paths.getVerifierWorktreePath({ specId: SPEC_ID, pass: launch.pass }),
        ),
      }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.VERIFIER_RUNNING });
  });
});
