import { readFile, writeFile } from 'node:fs/promises';

import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';

import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { csvExportEscalation } from '#tests/fixtures/csv-export-escalation.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { registerRecordBuilderHandoffTool } from '#tools/child/record-builder-handoff.ts';
import { registerMarkSpecReadyTool } from '#tools/main/mark-spec-ready.ts';
import { registerResolveEscalationsTool } from '#tools/main/resolve-escalations.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import {
  type EscalationDecision,
  resolveEscalations,
} from '#workflow/builder/resolveEscalations.ts';
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
  it('given escalation resolution inputs when the tool schema is checked then a nonempty decision batch with reasons is required and extra fields are rejected', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerResolveEscalationsTool,
    });

    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        specChangeRequired: false,
        decisions,
      }),
    ).toBe(true);

    for (const params of [
      { specId: SPEC_ID, specChangeRequired: false, decisions: [] },
      {
        specId: SPEC_ID,
        specChangeRequired: false,
        decisions: [{ ...decisions[0], reason: undefined }],
      },
      {
        specId: SPEC_ID,
        specChangeRequired: false,
        decisions,
        phase: WORKFLOW_PHASES.ESCALATION_DECISIONS,
      },
      { specId: SPEC_ID, specChangeRequired: false, ...decisions[0] },
    ])
      expect(Value.Check(tool.parameters, params)).toBe(false);
  });

  it('given unanswered builder questions when the owner answers all without a spec change then answers are saved in B1, the builder can run again, and new questions restart at E1 in B2', async () => {
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
      specChangeRequired: false,
      decisions,
    });

    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      nextAction: 'Run the builder separately. No renewed approval is required.',
      projectRoot: repository.path,
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: `All current escalations resolved. Spec ${SPEC_ID} is ready-for-builder. Run the builder separately. No renewed approval is required.`,
      },
    ]);
    expect((await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).phase).toBe(
      WORKFLOW_PHASES.READY_FOR_BUILDER,
    );

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
    expect(await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8')).toBe(specBefore);
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

    expect(await readBuilderHandoff({ path: b2, specId: SPEC_ID })).toMatchObject({
      escalations: [{ id: 'E1', resolution: null }],
    });

    expect(await readFile(handoffPath, 'utf8')).toBe(savedB1);
  });

  it('given earlier builder report B1 and new questions in B2 when the owner answers them with a spec revision then only B2 changes and separate approval returns the workflow to ready-for-builder', async () => {
    const { paths, repository, handoffPath } = await openEscalations();
    await resolveEscalations({
      paths,
      specId: SPEC_ID,
      specChangeRequired: false,
      decisions,
    });
    const b1Before = await readFile(handoffPath, 'utf8');
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    const { tool: builder } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRecordBuilderHandoffTool,
    });

    await builder.execute('next-pass', {
      specId: SPEC_ID,
      ...csvExportEscalation,
      escalations: [
        csvExportEscalation.escalations[0],
        {
          id: 'E2',
          question: 'Which encoding must exports use?',
          context: 'The spec requires UTF-8.',
          options: [
            {
              id: 'utf8',
              description: 'Use UTF-8.',
              consequences: 'The encoding stays unchanged.',
              nextStep: 'Keep the existing encoding.',
            },
          ],
          recommendation: null,
          notes: [],
          resolution: null,
        },
      ],
    });
    const b2 = await paths.getActiveBuilderHandoffPath(SPEC_ID);
    const before = await readBuilderHandoff({ path: b2, specId: SPEC_ID });

    const revisionDecisions = [
      {
        escalationId: 'E1',
        selectedOptionId: null,
        decision: 'Revise the spec to include archived rows',
        reason: 'Audit exports need complete history',
      },
      {
        escalationId: 'E2',
        selectedOptionId: 'utf8',
        decision: 'Use UTF-8',
        reason: 'Keep the existing encoding requirement',
      },
    ];

    const specBefore = await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8');

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveEscalationsTool,
    });

    const result = await tool.execute('revision-batch', {
      specId: SPEC_ID,
      specChangeRequired: true,
      decisions: revisionDecisions,
    });

    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      nextAction: expect.stringContaining('renewed GREEN FLAG'),
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(
          `is drafting-spec. Revise the same spec with the owner and obtain renewed GREEN FLAG. Then call maestro_mark_spec_ready separately before running the builder.`,
        ),
      },
    ]);
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });
    expect(await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8')).toBe(specBefore);
    expect(await readFile(handoffPath, 'utf8')).toBe(b1Before);
    expect(await readBuilderHandoff({ path: b2, specId: SPEC_ID })).toEqual({
      ...before,
      escalations: before.escalations.map((entry, index) => {
        const { escalationId: _id, ...resolution } = revisionDecisions[index];

        return { ...entry, resolution };
      }),
    });
    const resolvedB2 = await readFile(b2, 'utf8');
    await writeFile(
      paths.getSpecFilePath(SPEC_ID),
      '# Revised spec\n\n### AC1: Include archived rows\nExports include archived rows.\n',
    );

    // Simulate the separate approval call after the owner gives renewed GREEN FLAG.
    const { tool: approval } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerMarkSpecReadyTool,
    });

    const approved = await approval.execute('renewed-approval', {
      specId: SPEC_ID,
    });

    expect(approved.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toEqual(approved.details);
    expect(await readFile(b2, 'utf8')).toBe(resolvedB2);
    expect(await readFile(handoffPath, 'utf8')).toBe(b1Before);
  });

  it.each([undefined, 'true', 1, null])(
    'given specChangeRequired is %j instead of a boolean when resolution inputs are checked then the tool schema rejects the request',
    async (specChangeRequired) => {
      const { tool } = await piTestSessions.createRegisteredTool({
        extension: registerResolveEscalationsTool,
      });

      expect(
        Value.Check(tool.parameters, {
          specId: SPEC_ID,
          decisions,
          ...(specChangeRequired === undefined ? {} : { specChangeRequired }),
        }),
      ).toBe(false);
    },
  );

  it('given unanswered builder questions when direct spec approval is requested then approval fails and the spec, workflow, and builder report stay unchanged', async () => {
    const { paths, repository, handoffPath } = await openEscalations();

    const savedPaths = [
      paths.getWorkflowPath(SPEC_ID),
      paths.getSpecFilePath(SPEC_ID),
      handoffPath,
    ];

    const before = await Promise.all(savedPaths.map((path) => readFile(path)));

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerMarkSpecReadyTool,
    });

    await expect(tool.execute('premature-approval', { specId: SPEC_ID })).rejects.toThrow(
      'is not allowed from phase "escalation-decisions"',
    );
    expect(await Promise.all(savedPaths.map((path) => readFile(path)))).toEqual(before);
  });

  it.each([
    ['missing the decision for E2', [decisions[0]]],
    ['with duplicate decisions for E1', [decisions[0], decisions[0], decisions[1]]],
    ['naming an unknown escalation E3', [decisions[0], { ...decisions[1], escalationId: 'E3' }]],
    [
      'selecting an option absent from the question',
      [{ ...decisions[0], selectedOptionId: 'other' }, decisions[1]],
    ],
    [
      'with a decision containing only whitespace',
      [{ ...decisions[0], decision: ' \n\t' }, decisions[1]],
    ],
    [
      'with a reason containing only whitespace',
      [decisions[0], { ...decisions[1], reason: ' \n\t' }],
    ],
    ['with no decisions', []],
  ])(
    'given an escalation decision batch %s when submitted then resolution fails without changing the builder report or workflow',
    async (_name, invalidDecisions) => {
      const { paths, repository, handoffPath } = await openEscalations();
      const handoffBefore = await readFile(handoffPath, 'utf8');

      const workflowBefore = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

      const { tool } = await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerResolveEscalationsTool,
      });

      await expect(
        tool.execute('invalid-owner-batch', {
          specId: SPEC_ID,
          specChangeRequired: false,
          decisions: invalidDecisions,
        }),
      ).rejects.toThrow();

      // Exercise domain validation too, including schema-invalid batches rejected by Pi.
      await expect(
        resolveEscalations({
          paths,
          specId: SPEC_ID,
          specChangeRequired: false,
          decisions: invalidDecisions,
        }),
      ).rejects.toThrow();

      expect(await readFile(handoffPath, 'utf8')).toBe(handoffBefore);
      expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(workflowBefore);
    },
  );

  it.each([
    {
      scenario: 'wrong-phase',
      description: 'a workflow in builder-running',
    },
    {
      scenario: 'incompatible-handoff',
      description: 'a done report instead of an escalation',
    },
    {
      scenario: 'resolved',
      description: 'answered questions in ready-for-builder',
    },
    {
      scenario: 'resolved-in-decision-phase',
      description: 'answered questions in decision phase',
    },
  ])(
    'given $description when escalation decisions are submitted then resolution fails without changing the builder report or workflow',
    async ({ scenario }) => {
      const { paths, repository, handoffPath } = await openEscalations();

      if (scenario.startsWith('resolved'))
        await resolveEscalations({
          paths,
          specId: SPEC_ID,
          specChangeRequired: false,
          decisions,
        });

      if (scenario === 'wrong-phase' || scenario === 'resolved-in-decision-phase') {
        const state = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));
        await writeWorkflowState({
          path: paths.getWorkflowPath(SPEC_ID),
          state: {
            ...state,
            phase:
              scenario === 'wrong-phase'
                ? WORKFLOW_PHASES.BUILDER_RUNNING
                : WORKFLOW_PHASES.ESCALATION_DECISIONS,
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

      const workflowBefore = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

      const { tool } = await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerResolveEscalationsTool,
      });

      await expect(
        tool.execute('invalid-owner-batch', {
          specId: SPEC_ID,
          specChangeRequired: false,
          decisions,
        }),
      ).rejects.toThrow();

      expect(await readFile(handoffPath, 'utf8')).toBe(handoffBefore);

      expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(workflowBefore);
    },
  );
});
