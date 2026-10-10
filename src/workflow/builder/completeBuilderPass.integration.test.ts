import { access, readdir, readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { csvExportEscalation } from '#test/fixtures/csv-export-escalation.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { registerRecordBuilderHandoffTool } from '#tools/child/record-builder-handoff.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { resolveEscalations } from '#workflow/escalation/resolveEscalations.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('builder completion', () => {
  it('given a running builder when a done handoff is submitted then the handoff and state are saved in the current project', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    const handoff = {
      status: BUILDER_HANDOFF_STATUSES.DONE,
      escalations: [],
      summary: 'Implemented the approved change.',
      acceptanceCriteria: [],
      notes: [],
    };

    const completed = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff,
    });

    expect(completed.projectRoot).toBe(repository.path);
    expect(completed.state.phase).toBe(WORKFLOW_PHASES.READY_FOR_VERIFIER);

    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    });
  });
  it.each([PROBE_STATUSES.NOT_RUN, PROBE_STATUSES.PASSED])(
    'given an escalation with a %s probe when submitted and followed by a done handoff then the workflow moves through escalation-decision to ready-for-verifier',
    async (probeStatus) => {
      const { paths, repository } = await createApprovedWorkflow();
      await prepareBuilderRun({ paths, specId: SPEC_ID });

      const { tool } = await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerRecordBuilderHandoffTool,
      });

      const result = await tool.execute('escalation', {
        specId: SPEC_ID,
        ...csvExportEscalation,
        acceptanceCriteria: [
          { ...csvExportEscalation.acceptanceCriteria[0], probeStatus },
        ],
      });

      expect(result.details).toMatchObject({
        phase: WORKFLOW_PHASES.ESCALATION_DECISION,
      });
      expect(
        (await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).phase,
      ).toBe(WORKFLOW_PHASES.ESCALATION_DECISION);
      await expect(
        access(`${paths.getSpecPath(SPEC_ID)}/handoffs/escalations`),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      await resolveEscalations({
        paths,
        specId: SPEC_ID,
        decisions: csvExportEscalation.escalations.map(({ id }) => ({
          escalationId: id,
          selectedOptionId: 'exclude',
          decision: 'Exclude rows',
          reason: 'Keep exports current',
        })),
      });
      await prepareBuilderRun({ paths, specId: SPEC_ID });

      const done = await tool.execute('done', {
        specId: SPEC_ID,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        summary: 'Implemented CSV exports.',
        acceptanceCriteria: [
          {
            id: 'AC1',
            probe: 'CSV export check passed.',
            probeStatus: PROBE_STATUSES.PASSED,
          },
        ],
        notes: [],
        escalations: [],
      });

      expect(done.details).toMatchObject({
        phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
      });
      expect(
        (await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).phase,
      ).toBe(WORKFLOW_PHASES.READY_FOR_VERIFIER);
    },
  );

  it.each([
    ['empty escalations', { ...csvExportEscalation, escalations: [] }],
    [
      'done with escalations',
      { ...csvExportEscalation, status: BUILDER_HANDOFF_STATUSES.DONE },
    ],
    [
      'nonsequential IDs',
      {
        ...csvExportEscalation,
        escalations: [
          csvExportEscalation.escalations[0],
          { ...csvExportEscalation.escalations[1], id: 'E3' },
        ],
      },
    ],
    [
      'first ID not E1',
      {
        ...csvExportEscalation,
        escalations: [{ ...csvExportEscalation.escalations[0], id: 'E2' }],
      },
    ],
    [
      'empty options',
      {
        ...csvExportEscalation,
        escalations: [{ ...csvExportEscalation.escalations[0], options: [] }],
      },
    ],
    [
      'duplicate options',
      {
        ...csvExportEscalation,
        escalations: [
          {
            ...csvExportEscalation.escalations[0],
            options: [
              csvExportEscalation.escalations[0].options[0],
              csvExportEscalation.escalations[0].options[0],
            ],
          },
        ],
      },
    ],
    [
      'unknown recommendation',
      {
        ...csvExportEscalation,
        escalations: [
          {
            ...csvExportEscalation.escalations[0],
            recommendation: { optionId: 'other', reason: 'Not listed' },
          },
        ],
      },
    ],
    [
      'owner resolution',
      {
        ...csvExportEscalation,
        escalations: [
          {
            ...csvExportEscalation.escalations[0],
            resolution: {
              selectedOptionId: 'exclude',
              decision: 'Exclude rows',
              reason: 'Current rows only',
            },
          },
        ],
      },
    ],
    [
      'done with failed probe',
      {
        ...csvExportEscalation,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        escalations: [],
        acceptanceCriteria: [
          { id: 'AC1', probe: 'CSV check', probeStatus: PROBE_STATUSES.FAILED },
        ],
      },
    ],
    [
      'done with not-run probe',
      {
        ...csvExportEscalation,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        escalations: [],
      },
    ],
    [
      'done with passed and incomplete probes',
      {
        ...csvExportEscalation,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        escalations: [],
        acceptanceCriteria: [
          { id: 'AC1', probe: 'CSV check', probeStatus: PROBE_STATUSES.PASSED },
          {
            id: 'AC2',
            probe: 'CSV check',
            probeStatus: PROBE_STATUSES.NOT_RUN,
          },
        ],
      },
    ],
    [
      'done with duplicate criterion IDs',
      {
        ...csvExportEscalation,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        escalations: [],
        acceptanceCriteria: [
          { id: 'AC1', probe: 'CSV check', probeStatus: PROBE_STATUSES.PASSED },
          { id: 'AC1', probe: 'CSV check', probeStatus: PROBE_STATUSES.PASSED },
        ],
      },
    ],
  ])(
    'given a %s builder submission when recorded then it is rejected without writing a handoff or workflow state',
    async (_name, handoff) => {
      const { paths, repository } = await createApprovedWorkflow();
      await prepareBuilderRun({ paths, specId: SPEC_ID });
      const before = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

      const { tool } = await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerRecordBuilderHandoffTool,
      });

      await expect(
        tool.execute('invalid-handoff', { specId: SPEC_ID, ...handoff }),
      ).rejects.toThrow();
      expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(
        before,
      );
      // No protocol directory is created by rejected submissions.
      await expect(
        readdir(paths.getBuilderHandoffsPath(SPEC_ID)),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );
});
