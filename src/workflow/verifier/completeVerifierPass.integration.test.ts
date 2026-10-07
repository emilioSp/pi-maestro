import { access, mkdir, readFile, rename } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { writeVerifierHandoff } from '#artifacts/verifier-handoff/writeVerifierHandoff.ts';
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

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();

  return { ...actual, rename: vi.fn(actual.rename) };
});

const { rename: originalRename } =
  await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');

afterEach(async () => {
  vi.mocked(rename).mockImplementation(originalRename);
  await cleanupBuilderWorkflows();
});

const approvedHandoff = {
  version: VERIFIER_HANDOFF_VERSION,
  specId: SPEC_ID,
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

  const verifierRun = await prepareVerifierRun({
    paths: workflow.paths,
    specId: SPEC_ID,
  });

  return { ...workflow, builderRun, verifierRun };
};

describe('verifier completion', () => {
  it('given a saved V2 handoff when phase replacement fails then the running phase and V2 remain for inspection', async () => {
    const { paths } = await prepareRunningVerifier();
    await mkdir(paths.getVerifierHandoffsPath(SPEC_ID), { recursive: true });
    await writeVerifierHandoff({
      path: paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffNumber: 1 }),
      specId: SPEC_ID,
      handoff: approvedHandoff,
    });
    const workflowPath = paths.getWorkflowPath(SPEC_ID);
    const before = await readFile(workflowPath, 'utf8');
    vi.mocked(rename).mockImplementation(async (source, destination) => {
      if (destination === workflowPath)
        throw new Error('Phase replacement failed');

      await originalRename(source, destination);
    });
    await expect(
      completeVerifierPass({
        paths,
        specId: SPEC_ID,
        handoff: { ...approvedHandoff, summary: 'Checked greeting' },
      }),
    ).rejects.toThrow('Phase replacement failed');
    await expect(readFile(workflowPath, 'utf8')).resolves.toBe(before);
    await expect(readWorkflowState(workflowPath)).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });

    const saved = JSON.parse(
      await readFile(
        paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffNumber: 2 }),
        'utf8',
      ),
    );

    expect(saved).toMatchObject({
      version: '1.0.0',
      specId: SPEC_ID,
      summary: 'Checked greeting',
    });
  });

  it('writes one verifier handoff on the current project', async () => {
    const { paths, repository } = await prepareRunningVerifier();

    const handoff = {
      ...approvedHandoff,
    };

    const completed = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      handoff,
    });

    expect(completed.projectRoot).toBe(repository.path);
    expect(completed.state.phase).toBe(WORKFLOW_PHASES.CANDIDATE_READY);

    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
  });

  it('given an invalid handoff specId when the verifier submits it then no protocol write occurs', async () => {
    const { paths } = await prepareRunningVerifier();
    const workflowPath = paths.getWorkflowPath(SPEC_ID);
    const workflowBefore = await readFile(workflowPath, 'utf8');

    await expect(
      completeVerifierPass({
        paths,
        specId: SPEC_ID,
        handoff: {
          ...approvedHandoff,
          specId: '20260321-143052-other-spec',
        },
      }),
    ).rejects.toThrow('Verifier handoff spec ID mismatch');

    await expect(readFile(workflowPath, 'utf8')).resolves.toBe(workflowBefore);
    await expect(
      access(
        paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffNumber: 1 }),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
