import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { csvExportEscalation } from '#tests/fixtures/csv-export-escalation.ts';
import { unavailableCompilerEscalation } from '#tests/fixtures/unavailable-compiler-escalation.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { registerRecordBuilderHandoffTool } from '#tools/child/record-builder-handoff.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { resolveEscalations } from '#workflow/builder/resolveEscalations.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('builder completion', () => {
  it('given the builder is running when it submits a done report with passed probes then the current project workflow moves to ready-for-verifier', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    const handoff = {
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
    'given a compiler escalation with a probe marked %s when the owner answers it and the next builder run succeeds then B1 keeps the answer, B2 records success, and the workflow becomes ready-for-verifier',
    async (probeStatus) => {
      const { paths, repository } = await createApprovedWorkflow();
      await prepareBuilderRun({ paths, specId: SPEC_ID });

      const { tool } = await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerRecordBuilderHandoffTool,
      });

      const specBefore = await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8');

      const acceptanceCriteria = [
        {
          id: 'AC1',
          probe:
            probeStatus === PROBE_STATUSES.PASSED
              ? 'The acceptance probe passed before the compiler repository check.'
              : unavailableCompilerEscalation.acceptanceCriteria[0].probe,
          probeStatus,
        },
      ];

      const result = await tool.execute('escalation', {
        specId: SPEC_ID,
        ...unavailableCompilerEscalation,
        acceptanceCriteria,
      });

      const b1 = await paths.getActiveBuilderHandoffPath(SPEC_ID);
      expect(b1).toBe(
        paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }),
      );
      expect(
        await readBuilderHandoff({ path: b1, specId: SPEC_ID }),
      ).toMatchObject({
        acceptanceCriteria,
        escalations: unavailableCompilerEscalation.escalations,
      });

      expect(result.details).toMatchObject({
        phase: WORKFLOW_PHASES.ESCALATION_DECISIONS,
      });
      expect(
        (await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).phase,
      ).toBe(WORKFLOW_PHASES.ESCALATION_DECISIONS);
      await expect(
        access(`${paths.getSpecPath(SPEC_ID)}/handoffs/escalations`),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      await resolveEscalations({
        paths,
        specId: SPEC_ID,
        specChangeRequired: false,
        decisions: [
          {
            escalationId: 'E1',
            selectedOptionId: 'restore',
            decision: 'Retry the required check',
            reason: 'The compiler is available now.',
          },
        ],
      });
      await prepareBuilderRun({ paths, specId: SPEC_ID });

      const { tool: nextBuilder } = await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerRecordBuilderHandoffTool,
      });

      const done = await nextBuilder.execute('done', {
        specId: SPEC_ID,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        summary: 'Implemented the approved change and ran the compiler check.',
        acceptanceCriteria: [
          {
            id: 'AC1',
            probe: 'The required compiler check passed.',
            probeStatus: PROBE_STATUSES.PASSED,
          },
        ],
        notes: [],
        escalations: [],
      });

      const b2 = paths.getBuilderHandoffPath({
        specId: SPEC_ID,
        handoffPassNumber: 2,
      });

      expect(done.details).toMatchObject({
        handoffPath: b2,
        phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
      });
      expect(
        await readBuilderHandoff({ path: b2, specId: SPEC_ID }),
      ).toMatchObject({
        status: BUILDER_HANDOFF_STATUSES.DONE,
        escalations: [],
        acceptanceCriteria: [{ id: 'AC1', probeStatus: PROBE_STATUSES.PASSED }],
      });
      expect(await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8')).toBe(
        specBefore,
      );
      expect(
        await readBuilderHandoff({ path: b1, specId: SPEC_ID }),
      ).toMatchObject({
        acceptanceCriteria,
        escalations: [
          {
            resolution: {
              decision: 'Retry the required check',
              reason: 'The compiler is available now.',
            },
          },
        ],
      });
      expect(
        (await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).phase,
      ).toBe(WORKFLOW_PHASES.READY_FOR_VERIFIER);
    },
  );

  it('given a compiler escalation with passed, failed, and unrun probes when the builder submits its report then every probe result is preserved and the workflow enters escalation-decisions', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRecordBuilderHandoffTool,
    });

    const acceptanceCriteria = [
      {
        id: 'AC1',
        probe: 'The acceptance test passed.',
        probeStatus: PROBE_STATUSES.PASSED,
      },
      {
        id: 'AC2',
        probe: 'The export test failed.',
        probeStatus: PROBE_STATUSES.FAILED,
      },
      {
        id: 'AC3',
        probe: 'The compiler check could not run.',
        probeStatus: PROBE_STATUSES.NOT_RUN,
      },
    ];

    await tool.execute('mixed-probes', {
      specId: SPEC_ID,
      ...unavailableCompilerEscalation,
      acceptanceCriteria,
    });
    expect(
      await readBuilderHandoff({
        path: await paths.getActiveBuilderHandoffPath(SPEC_ID),
        specId: SPEC_ID,
      }),
    ).toMatchObject({
      status: BUILDER_HANDOFF_STATUSES.ESCALATION,
      acceptanceCriteria,
    });
    expect(
      (await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).phase,
    ).toBe(WORKFLOW_PHASES.ESCALATION_DECISIONS);
  });

  it.each([
    [
      'an escalation report with no questions',
      { ...csvExportEscalation, escalations: [] },
    ],
    [
      'a done report containing escalation questions',
      { ...csvExportEscalation, status: BUILDER_HANDOFF_STATUSES.DONE },
    ],
    [
      'escalation IDs that skip E2',
      {
        ...csvExportEscalation,
        escalations: [
          csvExportEscalation.escalations[0],
          { ...csvExportEscalation.escalations[1], id: 'E3' },
        ],
      },
    ],
    [
      'escalation IDs starting at E2 instead of E1',
      {
        ...csvExportEscalation,
        escalations: [{ ...csvExportEscalation.escalations[0], id: 'E2' }],
      },
    ],
    [
      'an escalation question with no options',
      {
        ...csvExportEscalation,
        escalations: [{ ...csvExportEscalation.escalations[0], options: [] }],
      },
    ],
    [
      'an escalation question with duplicate options',
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
      'a recommendation for an option absent from the question',
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
      'a new escalation question already containing an owner answer',
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
      'a done report with a failed probe',
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
      'a done report with an unrun probe',
      {
        ...csvExportEscalation,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        escalations: [],
      },
    ],
    [
      'a done report with one passed probe and one unrun probe',
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
      'a done report with duplicate acceptance criterion IDs',
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
    'given %s when a builder report is submitted then submission fails without saving a report or changing the workflow',
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

describe('builder spec criterion presence', () => {
  it('given the spec requires AC1 and AC2 when a done builder report covers only AC1 then submission fails naming AC2 without saving a report or changing the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await writeFile(
      paths.getSpecFilePath(SPEC_ID),
      await readFile(
        new URL(
          '../../../tests/fixtures/two-acceptance-criteria-spec.md',
          import.meta.url,
        ),
      ),
    );
    await prepareBuilderRun({ paths, specId: SPEC_ID });
    const workflowBefore = await readFile(paths.getWorkflowPath(SPEC_ID));

    const entriesBefore = await readdir(paths.getSpecPath(SPEC_ID), {
      recursive: true,
    });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRecordBuilderHandoffTool,
    });

    await expect(
      tool.execute('missing-criterion', {
        specId: SPEC_ID,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        summary: 'Checked first criterion.',
        acceptanceCriteria: [
          {
            id: 'AC1',
            probe: 'First criterion check',
            probeStatus: PROBE_STATUSES.PASSED,
          },
        ],
        escalations: [],
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
        paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
