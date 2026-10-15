/**
 * Objective: Check verifier completion, saved handoffs, and rejected submissions.
 * Used: In workflow integration tests with a running verifier.
 */

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { writeVerifierHandoff } from '#artifacts/verifier-handoff/writeVerifierHandoff.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { registerRecordVerifierHandoffTool } from '#tools/child/record-verifier-handoff.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();

  return { ...actual, writeFile: vi.fn(actual.writeFile) };
});

const { writeFile: originalWriteFile } =
  await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');

afterEach(async () => {
  vi.mocked(writeFile).mockRestore();
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

const approvedHandoff = {
  version: VERIFIER_HANDOFF_VERSION,
  specId: SPEC_ID,
  summary: 'The candidate satisfies the approved specification.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'Acceptance check',
      probeStatus: PROBE_STATUSES.PASSED,
    },
  ],
  findings: [],
  notes: [],
};

const prepareRunningVerifier = async () => {
  const workflow = await createApprovedWorkflow();

  await prepareBuilderRun({
    paths: workflow.paths,
    specId: SPEC_ID,
  });

  await completeBuilderPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: {
      status: BUILDER_HANDOFF_STATUSES.DONE,
      escalations: [],
      summary: 'Implemented the approved change.',
      acceptanceCriteria: [
        {
          id: 'AC1',
          probe: 'Acceptance check',
          probeStatus: PROBE_STATUSES.PASSED,
        },
      ],
      notes: [],
    },
  });

  await prepareVerifierRun({
    paths: workflow.paths,
    specId: SPEC_ID,
  });

  return workflow;
};

describe('verifier completion', () => {
  it('given a saved V2 handoff when the phase write fails then V2 remains for inspection', async () => {
    const { paths } = await prepareRunningVerifier();
    await mkdir(paths.getVerifierHandoffsPath(SPEC_ID), { recursive: true });
    await writeVerifierHandoff({
      path: paths.getVerifierHandoffPath({
        specId: SPEC_ID,
        handoffPassNumber: 1,
      }),
      specId: SPEC_ID,
      handoff: approvedHandoff,
    });
    const workflowPath = paths.getWorkflowPath(SPEC_ID);

    vi.mocked(writeFile).mockImplementation(async (path, data, options) => {
      if (path === workflowPath) throw new Error('Phase write failed');

      await originalWriteFile(path, data, options);
    });

    await expect(
      completeVerifierPass({
        paths,
        specId: SPEC_ID,
        handoff: { ...approvedHandoff, summary: 'Checked greeting' },
      }),
    ).rejects.toThrow('Phase write failed');

    const saved = JSON.parse(
      await readFile(
        paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 2 }),
        'utf8',
      ),
    );

    expect(saved).toMatchObject({
      version: '1.0.0',
      specId: SPEC_ID,
      summary: 'Checked greeting',
    });
  });

  it('given a running verifier when a valid handoff is submitted then one verifier handoff is saved in the current project', async () => {
    const { paths, repository } = await prepareRunningVerifier();

    const completed = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      handoff: approvedHandoff,
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
        paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('verifier spec criterion presence', () => {
  it('given AC1 and AC2 in the spec when a verifier submission contains only AC1 then no report or phase change is saved', async () => {
    const { paths, repository } = await prepareRunningVerifier();
    await writeFile(
      paths.getSpecFilePath(SPEC_ID),
      await readFile(
        new URL(
          '../../../tests/fixtures/two-acceptance-criteria-spec.md',
          import.meta.url,
        ),
      ),
    );
    const workflowBefore = await readFile(paths.getWorkflowPath(SPEC_ID));

    const entriesBefore = await readdir(paths.getSpecPath(SPEC_ID), {
      recursive: true,
    });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    await expect(
      tool.execute('missing-criterion', {
        specId: SPEC_ID,
        summary: 'Checked first criterion.',
        acceptanceCriteria: [
          {
            id: 'AC1',
            probe: 'First criterion check',
            probeStatus: PROBE_STATUSES.PASSED,
          },
        ],
        findings: [],
        notes: [],
      }),
    ).rejects.toThrow(
      'Handoff is missing acceptance criterion IDs from spec.md: AC2.',
    );

    expect(await readFile(paths.getWorkflowPath(SPEC_ID))).toEqual(
      workflowBefore,
    );
    expect(
      await readdir(paths.getSpecPath(SPEC_ID), { recursive: true }),
    ).toEqual(entriesBefore);
    await expect(
      access(
        paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
