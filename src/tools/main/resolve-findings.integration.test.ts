/**
 * Objective: Verify the owner finding resolution tool.
 * Used: When testing finding decisions, checkpoints, and spec revisions.
 */

import { readFile, writeFile } from 'node:fs/promises';
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type { TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
  type VerifierFinding,
} from '#artifacts/verifier-handoff/schema.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { registerResolveFindingsTool } from '#tools/main/resolve-findings.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { FINDING_DECISIONS } from '#workflow/findings/resolveFindings.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

type RegisteredTool = ToolDefinition<TSchema, unknown, unknown>;

type FindingDecisionInput =
  | {
      findingId: string;
      decision: typeof FINDING_DECISIONS.REJECT;
      reason: string;
    }
  | {
      findingId: string;
      decision: typeof FINDING_DECISIONS.FIX_CODE;
    };

type ResolveFindingsInput = {
  specId: string;
  decisions: FindingDecisionInput[];
};

type FindingResolutionDetails = {
  specId: string;
  revision: number;
  phase: string;
  repositoryRoot: string;
  checkpointCommit: string;
  rejectedFindingIds: string[];
  findingsRequiringFixIds: string[];
};

const createRegisteredTool = (): RegisteredTool => {
  let registeredTool: RegisteredTool | undefined;

  // JUSTIFICATION: The fake implements only the registration method used by this test.
  const pi = {
    registerTool: (tool: RegisteredTool): void => {
      registeredTool = tool;
    },
  } as ExtensionAPI;

  registerResolveFindingsTool(pi);

  if (registeredTool === undefined) {
    throw new Error('Resolve findings tool was not registered.');
  }

  return registeredTool;
};

type ExecuteToolInput = {
  repositoryRoot: string;
  input: ResolveFindingsInput;
};

const executeTool = async ({ repositoryRoot, input }: ExecuteToolInput) => {
  const tool = createRegisteredTool();
  // JUSTIFICATION: The adapter only reads cwd from the extension context.
  const context = { cwd: repositoryRoot } as ExtensionContext;

  return tool.execute('test-call', input, undefined, undefined, context);
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
  rejection: null,
});

type CreateFindingsDecisionWorkflowInput = {
  findings: VerifierFinding[];
};

const createFindingsDecisionWorkflow = async ({
  findings,
}: CreateFindingsDecisionWorkflowInput) => {
  const workflow = await createApprovedWorkflow();

  await prepareBuilderLaunch({ paths: workflow.paths, specId: SPEC_ID });
  await completeBuilderPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: {
      status: 'done',
      summary: 'Implemented the approved change.',
      acceptanceCriteria: [],
      notes: [],
    },
  });
  await commitAll({
    path: workflow.repository.path,
    message: 'Builder completed',
  });

  const verifierLaunch = await prepareVerifierLaunch({
    paths: workflow.paths,
    specId: SPEC_ID,
  });

  await completeVerifierPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    candidateCommit: verifierLaunch.candidateCommit,
    handoff: {
      version: VERIFIER_HANDOFF_VERSION,
      specId: SPEC_ID,
      revision: verifierLaunch.revision + 1,
      summary: 'The candidate has findings.',
      acceptanceCriteria: [],
      findings,
      notes: [],
    },
  });
  await commitAll({
    path: workflow.repository.path,
    message: 'Verifier findings',
  });

  return workflow;
};

const readCurrentHandoff = async ({ paths }: { paths: MaestroPaths }) => {
  const state = await readWorkflowState({
    path: paths.getWorkflowPath(SPEC_ID),
  });

  return readVerifierHandoff({
    path: paths.getVerifierHandoffPath(SPEC_ID),
    specId: SPEC_ID,
    revision: state.revision,
  });
};

afterEach(cleanupBuilderWorkflows);

describe('resolve findings tool', () => {
  it('registers a closed schema with conditional rejection reasons', () => {
    const tool = createRegisteredTool();

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

  it('records mixed decisions, prioritizes code fixes, and commits the current branch', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow({
      findings: [createFinding('F1'), createFinding('F2')],
    });

    const result = await executeTool({
      repositoryRoot: repository.path,
      input: {
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
      },
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
      repositoryRoot: repository.path,
      rejectedFindingIds: ['F1'],
      findingsRequiringFixIds: ['F2'],
    });
    await expect(
      getCurrentBranch({ repositoryRoot: repository.path }),
    ).resolves.toBe('main');
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(details.checkpointCommit);

    const handoff = await readCurrentHandoff({ paths });
    expect(handoff.findings).toMatchObject([
      { id: 'F1', rejection: { reason: 'The owner accepts this behavior.' } },
      { id: 'F2', rejection: null },
    ]);
  });

  it('records all rejections and commits candidate-ready on the current branch', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow({
      findings: [createFinding('F1'), createFinding('F2')],
    });

    const result = await executeTool({
      repositoryRoot: repository.path,
      input: {
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
      },
    });

    // JUSTIFICATION: The adapter returns this exact structured details shape.
    const details = result.details as FindingResolutionDetails;

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('candidate-ready'),
      },
    ]);
    expect(details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      rejectedFindingIds: ['F1', 'F2'],
      findingsRequiringFixIds: [],
    });
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(details.checkpointCommit);

    const handoff = await readCurrentHandoff({ paths });
    expect(handoff.findings).toMatchObject([
      {
        id: 'F1',
        rejection: { reason: 'The owner accepts the observed behavior.' },
      },
      {
        id: 'F2',
        rejection: { reason: 'The finding is outside the approved scope.' },
      },
    ]);
  });

  it('requires exact finding coverage before changing the workflow', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow({
      findings: [createFinding('F1'), createFinding('F2')],
    });

    const stateBefore = await readWorkflowState({
      path: paths.getWorkflowPath(SPEC_ID),
    });

    const handoffBefore = await readCurrentHandoff({ paths });
    const headBefore = await getHeadCommit({ repositoryRoot: repository.path });

    await expect(
      executeTool({
        repositoryRoot: repository.path,
        input: {
          specId: SPEC_ID,
          decisions: [
            {
              findingId: 'F1',
              decision: FINDING_DECISIONS.REJECT,
              reason: 'The owner accepts the observed behavior.',
            },
          ],
        },
      }),
    ).rejects.toThrow('Missing decision for finding "F2"');

    await expect(
      executeTool({
        repositoryRoot: repository.path,
        input: {
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
        },
      }),
    ).rejects.toThrow('Duplicate decision for finding "F1"');

    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toEqual(stateBefore);
    await expect(readCurrentHandoff({ paths })).resolves.toEqual(handoffBefore);
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(headBefore);
  });

  it('bypasses finding resolution when the owner revises the spec', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow({
      findings: [createFinding('F1')],
    });

    const stateBefore = await readWorkflowState({
      path: paths.getWorkflowPath(SPEC_ID),
    });

    const handoffBefore = await readCurrentHandoff({ paths });
    const headBefore = await getHeadCommit({ repositoryRoot: repository.path });
    const revisedSpec = '# Revised contract\n';

    await writeFile(paths.getSpecFilePath(SPEC_ID), revisedSpec, 'utf8');

    const stateAfter = await markSpecReady({
      paths,
      specId: SPEC_ID,
      activeWorkflowSpecId: SPEC_ID,
    });

    expect(stateAfter.phase).toBe(WORKFLOW_PHASES.READY_FOR_BUILDER);
    expect(stateAfter.revision).toBe(stateBefore.revision + 1);
    await expect(
      readFile(paths.getSpecFilePath(SPEC_ID), 'utf8'),
    ).resolves.toBe(revisedSpec);
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(headBefore);
    await expect(readCurrentHandoff({ paths })).rejects.toThrow(
      `expected ${stateAfter.revision}`,
    );
    await expect(
      readVerifierHandoff({
        path: paths.getVerifierHandoffPath(SPEC_ID),
        specId: SPEC_ID,
        revision: stateBefore.revision,
      }),
    ).resolves.toEqual(handoffBefore);
  });

  it('returns a domain error without resolving an unknown finding', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow({
      findings: [createFinding('F1')],
    });

    const stateBefore = await readWorkflowState({
      path: paths.getWorkflowPath(SPEC_ID),
    });

    const handoffBefore = await readCurrentHandoff({ paths });

    await expect(
      executeTool({
        repositoryRoot: repository.path,
        input: {
          specId: SPEC_ID,
          decisions: [
            {
              findingId: 'F2',
              decision: FINDING_DECISIONS.FIX_CODE,
            },
          ],
        },
      }),
    ).rejects.toThrow('Unknown finding ID: "F2"');

    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toEqual(stateBefore);
    await expect(readCurrentHandoff({ paths })).resolves.toEqual(handoffBefore);
  });
});
