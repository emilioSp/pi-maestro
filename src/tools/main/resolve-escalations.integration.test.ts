import { readFile, writeFile } from 'node:fs/promises';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { csvExportEscalation } from '#test/fixtures/csv-export-escalation.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { registerRecordBuilderHandoffTool } from '#tools/child/record-builder-handoff.ts';
import { registerResolveEscalationsTool } from '#tools/main/resolve-escalations.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import {
  type EscalationDecision,
  resolveEscalations,
} from '#workflow/escalation/resolveEscalations.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

const decisions: EscalationDecision[] = [
  {
    escalationId: 'E1',
    selectedOptionId: 'exclude',
    decision: 'Exclude archived rows',
    reason: 'Keep exports current',
  },
  {
    escalationId: 'E2',
    selectedOptionId: null,
    decision: 'Ask for confirmation before including deleted rows',
    reason: 'Prevent accidental disclosure',
  },
];

const openEscalations = async () => {
  const workflow = await createApprovedWorkflow();
  await prepareBuilderRun({ paths: workflow.paths, specId: SPEC_ID });

  const { tool } = await piTestSessions.createRegisteredTool({
    cwd: workflow.repository.path,
    extension: registerRecordBuilderHandoffTool,
  });

  await tool.execute('builder-handoff', {
    specId: SPEC_ID,
    ...csvExportEscalation,
  });
  const handoffPath = await workflow.paths.getActiveBuilderHandoffPath(SPEC_ID);

  return { ...workflow, handoffPath };
};

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('resolve escalations tool', () => {
  it('registers a closed nonempty owner batch schema', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerResolveEscalationsTool,
    });

    expect(Value.Check(tool.parameters, { specId: SPEC_ID, decisions })).toBe(
      true,
    );

    for (const params of [
      { specId: SPEC_ID, decisions: [] },
      { specId: SPEC_ID, decisions: [{ ...decisions[0], reason: undefined }] },
      {
        specId: SPEC_ID,
        decisions,
        phase: WORKFLOW_PHASES.ESCALATION_DECISION,
      },
      { specId: SPEC_ID, ...decisions[0] },
    ])
      expect(Value.Check(tool.parameters, params)).toBe(false);
  });

  it('records every exact owner resolution and saves ready-for-builder, then restarts IDs in B2', async () => {
    const { paths, repository, handoffPath } = await openEscalations();

    const before = await readBuilderHandoff({
      path: handoffPath,
      specId: SPEC_ID,
    });

    expect(before).toEqual({
      version: '1.0.0',
      specId: SPEC_ID,
      ...csvExportEscalation,
    });
    const specBefore = await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8');

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveEscalationsTool,
    });

    const result = await tool.execute('owner-batch', {
      specId: SPEC_ID,
      decisions,
    });

    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      projectRoot: repository.path,
    });
    expect(
      (await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).phase,
    ).toBe(WORKFLOW_PHASES.READY_FOR_BUILDER);

    const resolved = await readBuilderHandoff({
      path: handoffPath,
      specId: SPEC_ID,
    });

    expect(resolved).toEqual({
      ...before,
      escalations: csvExportEscalation.escalations.map((entry, index) => {
        const { escalationId: _id, ...resolution } = decisions[index];

        return { ...entry, resolution };
      }),
    });
    expect(await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8')).toBe(
      specBefore,
    );
    const savedB1 = await readFile(handoffPath, 'utf8');
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    const { tool: builder } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRecordBuilderHandoffTool,
    });

    await builder.execute('next-pass', {
      specId: SPEC_ID,
      ...csvExportEscalation,
      escalations: [
        {
          id: 'E1',
          question: 'Must CSV filenames include a timestamp?',
          context: 'Repeated exports can use the same filename.',
          options: [
            {
              id: 'timestamp',
              description: 'Include a timestamp.',
              consequences: 'Filenames are unique.',
              nextStep: 'Add the export time to the filename.',
            },
          ],
          recommendation: null,
          notes: [],
          resolution: null,
        },
      ],
    });

    const b2 = paths.getBuilderHandoffPath({
      specId: SPEC_ID,
      handoffPassNumber: 2,
    });

    expect(
      await readBuilderHandoff({ path: b2, specId: SPEC_ID }),
    ).toMatchObject({ escalations: [{ id: 'E1', resolution: null }] });

    expect(await readFile(handoffPath, 'utf8')).toBe(savedB1);
  });

  it('leaves revised-contract questions historical and updates only B2 resolution fields', async () => {
    const { paths, repository, handoffPath } = await openEscalations();
    const b1Before = await readFile(handoffPath, 'utf8');
    await writeFile(paths.getSpecFilePath(SPEC_ID), '# Revised contract\n');
    await markSpecReady({
      paths,
      specId: SPEC_ID,
      activeWorkflowSpecId: SPEC_ID,
    });
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    const { tool: builder } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRecordBuilderHandoffTool,
    });

    await builder.execute('next-pass', {
      specId: SPEC_ID,
      ...csvExportEscalation,
    });
    const b2 = await paths.getActiveBuilderHandoffPath(SPEC_ID);
    const before = await readBuilderHandoff({ path: b2, specId: SPEC_ID });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveEscalationsTool,
    });

    await tool.execute('owner-batch', { specId: SPEC_ID, decisions });
    expect(await readFile(handoffPath, 'utf8')).toBe(b1Before);
    expect(await readBuilderHandoff({ path: b2, specId: SPEC_ID })).toEqual({
      ...before,
      escalations: csvExportEscalation.escalations.map((entry, index) => {
        const { escalationId: _id, ...resolution } = decisions[index];

        return { ...entry, resolution };
      }),
    });
  });

  it.each([
    ['missing', [decisions[0]]],
    ['duplicate', [decisions[0], decisions[0], decisions[1]]],
    ['unknown', [decisions[0], { ...decisions[1], escalationId: 'E3' }]],
    [
      'unknown option',
      [{ ...decisions[0], selectedOptionId: 'other' }, decisions[1]],
    ],
    ['blank decision', [{ ...decisions[0], decision: ' \n\t' }, decisions[1]]],
    ['blank reason', [decisions[0], { ...decisions[1], reason: ' \n\t' }]],
    ['empty', []],
  ])(
    'given %s batch then no protocol file changes',
    async (_name, invalidDecisions) => {
      const { paths, repository, handoffPath } = await openEscalations();
      const handoffBefore = await readFile(handoffPath, 'utf8');

      const workflowBefore = await readFile(
        paths.getWorkflowPath(SPEC_ID),
        'utf8',
      );

      const { tool } = await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerResolveEscalationsTool,
      });

      await expect(
        tool.execute('invalid-owner-batch', {
          specId: SPEC_ID,
          decisions: invalidDecisions,
        }),
      ).rejects.toThrow();

      // Exercise domain validation too, including schema-invalid batches rejected by Pi.
      await expect(
        resolveEscalations({
          paths,
          specId: SPEC_ID,
          decisions: invalidDecisions,
        }),
      ).rejects.toThrow();

      expect(await readFile(handoffPath, 'utf8')).toBe(handoffBefore);
      expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(
        workflowBefore,
      );
    },
  );

  it.each([
    'wrong-phase',
    'incompatible-handoff',
    'resolved',
    'resolved-in-decision-phase',
  ])('given %s then rejects resolution without writes', async (scenario) => {
    const { paths, repository, handoffPath } = await openEscalations();

    if (scenario.startsWith('resolved'))
      await resolveEscalations({ paths, specId: SPEC_ID, decisions });

    if (
      scenario === 'wrong-phase' ||
      scenario === 'resolved-in-decision-phase'
    ) {
      const state = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));
      await writeWorkflowState({
        path: paths.getWorkflowPath(SPEC_ID),
        state: {
          ...state,
          phase:
            scenario === 'wrong-phase'
              ? WORKFLOW_PHASES.BUILDER_RUNNING
              : WORKFLOW_PHASES.ESCALATION_DECISION,
        },
      });
    }

    if (scenario === 'incompatible-handoff')
      await writeFile(
        handoffPath,
        JSON.stringify({
          version: '1.0.0',
          specId: SPEC_ID,
          status: BUILDER_HANDOFF_STATUSES.DONE,
          summary: 'Done',
          acceptanceCriteria: [],
          notes: [],
          escalations: [],
        }),
      );
    const handoffBefore = await readFile(handoffPath, 'utf8');

    const workflowBefore = await readFile(
      paths.getWorkflowPath(SPEC_ID),
      'utf8',
    );

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveEscalationsTool,
    });

    await expect(
      tool.execute('invalid-owner-batch', { specId: SPEC_ID, decisions }),
    ).rejects.toThrow();

    expect(await readFile(handoffPath, 'utf8')).toBe(handoffBefore);

    expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(
      workflowBefore,
    );
  });
});
