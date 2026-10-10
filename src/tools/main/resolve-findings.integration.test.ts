/**
 * Objective: Verify the owner finding resolution tool.
 * Used: When testing finding decisions and spec revisions.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
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
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { registerResolveFindingsTool } from '#tools/main/resolve-findings.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

type FindingResolutionDetails = {
  specId: string;
  phase: string;
  projectRoot: string;
  rejectedFindingIds: string[];
  findingsRequiringFixIds: string[];
};

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
      acceptanceCriteria: [],
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
      acceptanceCriteria: [],
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
  it('given the finding resolution tool when registered then its closed schema requires reasons for rejections', async () => {
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

  it('given mixed owner decisions when findings are resolved then decisions are saved and code fixes take priority', async () => {
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

    // JUSTIFICATION: The adapter returns this exact structured details shape.
    const details = result.details as FindingResolutionDetails;

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('F2'),
      },
    ]);
    expect(details).toMatchObject({
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

  it('given all findings rejected when decisions are recorded then rejections are saved and the workflow becomes candidate-ready', async () => {
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

    // JUSTIFICATION: The adapter returns this exact structured details shape.
    const details = result.details as FindingResolutionDetails;

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(WORKFLOW_PHASES.CANDIDATE_READY),
      },
    ]);
    expect(details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
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

  it('given incomplete or duplicate finding decisions when resolved then the workflow and handoff are unchanged', async () => {
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

  it('given an invalid handoff specId when all findings are rejected then no protocol write occurs', async () => {
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

  it('given an empty rejection reason when resolving findings then no protocol write occurs', async () => {
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

  it('given unresolved findings when the owner approves a revised spec then finding resolution is bypassed', async () => {
    const { paths } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const handoffBefore = await readCurrentHandoff(paths);
    const revisedSpec = '# Revised contract\n';

    await writeFile(paths.getSpecFilePath(SPEC_ID), revisedSpec, 'utf8');

    const stateAfter = await markSpecReady({
      paths,
      specId: SPEC_ID,
      activeWorkflowSpecId: SPEC_ID,
    });

    expect(stateAfter.phase).toBe(WORKFLOW_PHASES.READY_FOR_BUILDER);
    await expect(
      readFile(paths.getSpecFilePath(SPEC_ID), 'utf8'),
    ).resolves.toBe(revisedSpec);
    await expect(
      readVerifierHandoff({
        path: paths.getVerifierHandoffPath({
          specId: SPEC_ID,
          handoffPassNumber: 1,
        }),
        specId: SPEC_ID,
      }),
    ).resolves.toEqual(handoffBefore);
  });

  it('given an unknown finding when resolution is requested then a domain error is returned without changes', async () => {
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
