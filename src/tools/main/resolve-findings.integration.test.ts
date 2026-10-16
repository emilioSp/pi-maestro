/**
 * Objective: Verify the owner finding resolution tool.
 * Used: When testing finding decisions and spec revisions.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import {
  FINDING_DECISIONS,
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
  type VerifierFinding,
} from '#artifacts/verifier-handoff/schema.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { registerMarkSpecReadyTool } from '#tools/main/mark-spec-ready.ts';
import { registerResolveFindingsTool } from '#tools/main/resolve-findings.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

const createFinding = (id: string): VerifierFinding => ({
  id,
  acceptanceCriterion: null,
  severity: FINDING_SEVERITIES.MEDIUM,
  confidence: 0.9,
  summary: `Finding ${id} needs a decision.`,
  evidence: [
    {
      source: 'test source',
      observation: `Test evidence for ${id}.`,
    },
  ],
  decision: null,
});

const createFindingsDecisionWorkflow = async (findings: VerifierFinding[]) => {
  const workflow = await createApprovedWorkflow();

  await prepareBuilderRun({ paths: workflow.paths, specId: SPEC_ID });
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

  await completeVerifierPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: {
      version: VERIFIER_HANDOFF_VERSION,
      specId: SPEC_ID,
      summary: 'The candidate has findings.',
      acceptanceCriteria: [
        {
          id: 'AC1',
          probe: 'Acceptance check',
          probeStatus: PROBE_STATUSES.PASSED,
        },
      ],
      findings,
      notes: [],
    },
  });

  return workflow;
};

const readCurrentHandoff = async (paths: MaestroPaths) => {
  return readVerifierHandoff({
    path: await paths.getActiveVerifierHandoffPath(SPEC_ID),
    specId: SPEC_ID,
  });
};

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('resolve findings tool', () => {
  it('given finding decision inputs when the tool schema is checked then rejection requires a reason, code fixes forbid a reason, and empty or unknown decisions are rejected', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerResolveFindingsTool,
    });

    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        decisions: [
          {
            findingId: 'F1',
            decision: FINDING_DECISIONS.REJECT,
            reason: 'The owner accepts this behavior.',
          },
          {
            findingId: 'F2',
            decision: FINDING_DECISIONS.FIX_CODE,
          },
        ],
      }),
    ).toBe(true);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        decisions: [
          {
            findingId: 'F1',
            decision: FINDING_DECISIONS.REJECT,
          },
        ],
      }),
    ).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        decisions: [
          {
            findingId: 'F1',
            decision: FINDING_DECISIONS.FIX_CODE,
            reason: 'Not needed.',
          },
        ],
      }),
    ).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        decisions: [],
      }),
    ).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        decisions: [
          {
            findingId: 'F1',
            decision: 'ignore',
          },
        ],
      }),
    ).toBe(false);
  });

  it('given two findings when the owner rejects one and requests a code fix for the other then both decisions are saved and the workflow returns to ready-for-builder', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
      createFinding('F2'),
    ]);

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveFindingsTool,
    });

    const result = await tool.execute('test-call', {
      specId: SPEC_ID,
      decisions: [
        {
          findingId: 'F1',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'The owner accepts this behavior.',
        },
        {
          findingId: 'F2',
          decision: FINDING_DECISIONS.FIX_CODE,
        },
      ],
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('F2'),
      },
    ]);
    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      projectRoot: repository.path,
      rejectedFindingIds: ['F1'],
      findingsRequiringFixIds: ['F2'],
    });

    const handoff = await readCurrentHandoff(paths);
    expect(handoff.findings).toMatchObject([
      {
        id: 'F1',
        decision: {
          decision: FINDING_DECISIONS.REJECT,
          reason: 'The owner accepts this behavior.',
        },
      },
      { id: 'F2', decision: { decision: FINDING_DECISIONS.FIX_CODE } },
    ]);
  });

  it('given a single finding when the owner rejects it with a reason then the rejection is saved and Maestro requests simplification without another approval or verification', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveFindingsTool,
    });

    const result = await tool.execute('reject', {
      specId: SPEC_ID,
      decisions: [
        {
          findingId: 'F1',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'Outside approved scope',
        },
      ],
    });

    expect(
      await readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).toMatchObject({ phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(
          'Call maestro_run_simplifier next with this specId, without another approval or verifier pass.',
        ),
      },
    ]);
    const handoff = await readCurrentHandoff(paths);
    expect(handoff.findings[0].decision).toEqual({
      decision: FINDING_DECISIONS.REJECT,
      reason: 'Outside approved scope',
    });
  });

  it('given two findings when the owner rejects both with reasons then both rejections are saved and the workflow moves to simplifier-running', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
      createFinding('F2'),
    ]);

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveFindingsTool,
    });

    const result = await tool.execute('test-call', {
      specId: SPEC_ID,
      decisions: [
        {
          findingId: 'F1',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'The owner accepts the observed behavior.',
        },
        {
          findingId: 'F2',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'The finding is outside the approved scope.',
        },
      ],
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(WORKFLOW_PHASES.SIMPLIFIER_RUNNING),
      },
    ]);
    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
      rejectedFindingIds: ['F1', 'F2'],
      findingsRequiringFixIds: [],
    });

    const handoff = await readCurrentHandoff(paths);
    expect(handoff.findings).toMatchObject([
      {
        id: 'F1',
        decision: {
          decision: FINDING_DECISIONS.REJECT,
          reason: 'The owner accepts the observed behavior.',
        },
      },
      {
        id: 'F2',
        decision: {
          decision: FINDING_DECISIONS.REJECT,
          reason: 'The finding is outside the approved scope.',
        },
      },
    ]);
  });

  it('given two findings when a decision batch omits a finding or repeats its ID then resolution fails and the workflow and verifier report stay unchanged', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
      createFinding('F2'),
    ]);

    const stateBefore = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));

    const handoffBefore = await readCurrentHandoff(paths);

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveFindingsTool,
    });

    await expect(
      tool.execute('test-call', {
        specId: SPEC_ID,
        decisions: [
          {
            findingId: 'F1',
            decision: FINDING_DECISIONS.REJECT,
            reason: 'The owner accepts the observed behavior.',
          },
        ],
      }),
    ).rejects.toThrow('Missing decision for finding "F2"');

    await expect(
      tool.execute('test-call', {
        specId: SPEC_ID,
        decisions: [
          {
            findingId: 'F1',
            decision: FINDING_DECISIONS.REJECT,
            reason: 'The owner accepts the observed behavior.',
          },
          {
            findingId: 'F1',
            decision: FINDING_DECISIONS.FIX_CODE,
          },
          {
            findingId: 'F2',
            decision: FINDING_DECISIONS.FIX_CODE,
          },
        ],
      }),
    ).rejects.toThrow('Duplicate decision for finding "F1"');

    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toEqual(stateBefore);
    await expect(readCurrentHandoff(paths)).resolves.toEqual(handoffBefore);
  });

  it('given the saved verifier report names a different spec when the owner rejects its finding then resolution fails without changing the report or workflow', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const statePath = paths.getWorkflowPath(SPEC_ID);

    const handoffPath = paths.getVerifierHandoffPath({
      specId: SPEC_ID,
      handoffPassNumber: 1,
    });

    const handoff = await readCurrentHandoff(paths);
    await writeFile(
      handoffPath,
      JSON.stringify({ ...handoff, specId: '20260321-143052-other-spec' }),
      'utf8',
    );

    const stateBefore = await readFile(statePath, 'utf8');
    const handoffBefore = await readFile(handoffPath, 'utf8');

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveFindingsTool,
    });

    await expect(
      tool.execute('test-call', {
        specId: SPEC_ID,
        decisions: [
          {
            findingId: 'F1',
            decision: FINDING_DECISIONS.REJECT,
            reason: 'The owner accepts this behavior.',
          },
        ],
      }),
    ).rejects.toThrow('Verifier handoff spec ID mismatch');

    await expect(readFile(statePath, 'utf8')).resolves.toBe(stateBefore);
    await expect(readFile(handoffPath, 'utf8')).resolves.toBe(handoffBefore);
  });

  it('given a rejection reason containing only whitespace when finding decisions are submitted then resolution fails without changing the verifier report or workflow', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const statePath = paths.getWorkflowPath(SPEC_ID);

    const handoffPath = paths.getVerifierHandoffPath({
      specId: SPEC_ID,
      handoffPassNumber: 1,
    });

    const stateBefore = await readFile(statePath, 'utf8');
    const handoffBefore = await readFile(handoffPath, 'utf8');

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveFindingsTool,
    });

    await expect(
      tool.execute('test-call', {
        specId: SPEC_ID,
        decisions: [
          {
            findingId: 'F1',
            decision: FINDING_DECISIONS.REJECT,
            reason: '   ',
          },
        ],
      }),
    ).rejects.toThrow('Rejection reason for "F1" must not be empty.');

    await expect(readFile(statePath, 'utf8')).resolves.toBe(stateBefore);
    await expect(readFile(handoffPath, 'utf8')).resolves.toBe(handoffBefore);
  });

  it('given a finding about archived exports when the owner chooses spec revision then the decision is saved in drafting-spec and separate approval returns the same spec to ready-for-builder', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      { ...createFinding('F1'), summary: 'Exports omit archived rows.' },
    ]);

    const handoffPath = await paths.getActiveVerifierHandoffPath(SPEC_ID);
    const specBefore = await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8');

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveFindingsTool,
    });

    const result = await tool.execute('revision-choice', {
      specId: SPEC_ID,
      decisions: [
        {
          findingId: 'F1',
          decision: FINDING_DECISIONS.REVISE_SPEC,
          reason: 'Exports must show current records only',
          specChange: 'Exclude archived rows from exports',
        },
      ],
    });

    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      findingsRequiringSpecRevisionIds: ['F1'],
      findingsRequiringFixIds: [],
      rejectedFindingIds: [],
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Recorded rejections for none. Findings requiring code fixes: none. Findings requiring spec revision: F1. The workflow is drafting-spec. Revise the same spec with the owner and obtain renewed GREEN FLAG. Then call maestro_mark_spec_ready separately before running the builder.',
      },
    ]);
    expect(
      await readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });
    expect(await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8')).toBe(
      specBefore,
    );
    expect((await readCurrentHandoff(paths)).findings[0].decision).toEqual({
      decision: FINDING_DECISIONS.REVISE_SPEC,
      reason: 'Exports must show current records only',
      specChange: 'Exclude archived rows from exports',
    });
    const resolvedHandoff = await readFile(handoffPath, 'utf8');

    const revisedSpec =
      '# Export current rows\n\n### AC1: Export current rows\nExclude archived rows from exports.\n';

    await writeFile(paths.getSpecFilePath(SPEC_ID), revisedSpec);

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
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toEqual(
      approved.details,
    );
    expect(await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8')).toBe(
      revisedSpec,
    );
    expect(await readFile(handoffPath, 'utf8')).toBe(resolvedHandoff);
  });

  it('given a decision names a finding absent from the verifier report when it is submitted then resolution fails without changing the report or workflow', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const stateBefore = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));

    const handoffBefore = await readCurrentHandoff(paths);

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveFindingsTool,
    });

    await expect(
      tool.execute('test-call', {
        specId: SPEC_ID,
        decisions: [
          {
            findingId: 'F2',
            decision: FINDING_DECISIONS.FIX_CODE,
          },
        ],
      }),
    ).rejects.toThrow('Unknown finding ID: "F2"');

    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toEqual(stateBefore);
    await expect(readCurrentHandoff(paths)).resolves.toEqual(handoffBefore);
  });
});
