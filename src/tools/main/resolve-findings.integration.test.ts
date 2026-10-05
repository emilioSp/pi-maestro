/**
 * Objective: Verify the owner finding resolution tool.
 * Used: When testing finding decisions, checkpoints, and spec revisions.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
  type VerifierFinding,
} from '#artifacts/verifier-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import { getParentCommit } from '#git/history/getParentCommit.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { registerResolveFindingsTool } from '#tools/main/resolve-findings.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { FINDING_DECISIONS } from '#workflow/findings/resolveFindings.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

type FindingResolutionDetails = {
  specId: string;
  revision: number;
  phase: string;
  repositoryRoot: string;
  checkpointCommit: string;
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
  rejection: null,
});

const createFindingsDecisionWorkflow = async (findings: VerifierFinding[]) => {
  const workflow = await createApprovedWorkflow();

  await prepareBuilderLaunch({ paths: workflow.paths, specId: SPEC_ID });
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
  await workflow.repository.commit('Builder completed');

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
  await workflow.repository.commit('Verifier findings');

  return workflow;
};

const readCurrentHandoff = async (paths: MaestroPaths) => {
  const state = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));

  return readVerifierHandoff({
    path: paths.getVerifierHandoffPath(SPEC_ID),
    specId: SPEC_ID,
    revision: state.revision,
  });
};

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('resolve findings tool', () => {
  it('registers a closed schema with conditional rejection reasons', async () => {
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

  it('records mixed decisions, prioritizes code fixes, and commits the current branch', async () => {
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
      repositoryRoot: repository.path,
      rejectedFindingIds: ['F1'],
      findingsRequiringFixIds: ['F2'],
    });
    await expect(getCurrentBranch(repository.path)).resolves.toBe('main');
    await expect(getHeadCommit(repository.path)).resolves.toBe(
      details.checkpointCommit,
    );

    const handoff = await readCurrentHandoff(paths);
    expect(handoff.findings).toMatchObject([
      { id: 'F1', rejection: { reason: 'The owner accepts this behavior.' } },
      { id: 'F2', rejection: null },
    ]);
  });

  it('records all rejections and commits candidate-ready on the current branch', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
      createFinding('F2'),
    ]);

    const headBefore = await getHeadCommit(repository.path);

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
    await expect(getHeadCommit(repository.path)).resolves.toBe(
      details.checkpointCommit,
    );

    const handoff = await readCurrentHandoff(paths);
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
    await expect(getRepositoryStatus(repository.path)).resolves.toMatchObject({
      clean: true,
    });
    await expect(
      getParentCommit({
        repositoryRoot: repository.path,
        commit: details.checkpointCommit,
      }),
    ).resolves.toBe(headBefore);

    const commitFiles = await runGitCommand({
      arguments: ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'],
      cwd: repository.path,
    });

    expect(commitFiles.stdout.trim().split(/\r?\n/).sort()).toEqual(
      [paths.getWorkflowPath(SPEC_ID), paths.getVerifierHandoffPath(SPEC_ID)]
        .map((path) => relative(repository.path, path))
        .sort(),
    );
  });

  it('requires exact finding coverage before changing the workflow', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
      createFinding('F2'),
    ]);

    const stateBefore = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));

    const handoffBefore = await readCurrentHandoff(paths);
    const headBefore = await getHeadCommit(repository.path);

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
    await expect(getHeadCommit(repository.path)).resolves.toBe(headBefore);
  });

  it('given an unrelated staged change when all findings are rejected then protocol files stay unchanged', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const statePath = paths.getWorkflowPath(SPEC_ID);
    const handoffPath = paths.getVerifierHandoffPath(SPEC_ID);
    const stateBefore = await readFile(statePath, 'utf8');
    const handoffBefore = await readFile(handoffPath, 'utf8');

    const headBefore = await getHeadCommit(repository.path);

    await writeFile(
      join(repository.path, 'README.md'),
      'Unrelated change\n',
      'utf8',
    );

    await runGitCommand({
      arguments: ['add', '--', 'README.md'],
      cwd: repository.path,
    });

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
    ).rejects.toThrow(
      'Finding resolution requires no changes outside its protocol files.',
    );

    await expect(readFile(statePath, 'utf8')).resolves.toBe(stateBefore);
    await expect(readFile(handoffPath, 'utf8')).resolves.toBe(handoffBefore);
    await expect(getHeadCommit(repository.path)).resolves.toBe(headBefore);
  });

  it('given an unrelated unstaged change when all findings are rejected then protocol files stay unchanged', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const statePath = paths.getWorkflowPath(SPEC_ID);
    const handoffPath = paths.getVerifierHandoffPath(SPEC_ID);
    const stateBefore = await readFile(statePath, 'utf8');
    const handoffBefore = await readFile(handoffPath, 'utf8');

    const headBefore = await getHeadCommit(repository.path);

    await writeFile(
      join(repository.path, 'README.md'),
      'Unrelated change\n',
      'utf8',
    );

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
    ).rejects.toThrow(
      'Finding resolution requires no changes outside its protocol files.',
    );

    await expect(readFile(statePath, 'utf8')).resolves.toBe(stateBefore);
    await expect(readFile(handoffPath, 'utf8')).resolves.toBe(handoffBefore);
    await expect(getHeadCommit(repository.path)).resolves.toBe(headBefore);
  });

  it('given an unrelated untracked change when all findings are rejected then protocol files stay unchanged', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const statePath = paths.getWorkflowPath(SPEC_ID);
    const handoffPath = paths.getVerifierHandoffPath(SPEC_ID);
    const stateBefore = await readFile(statePath, 'utf8');
    const handoffBefore = await readFile(handoffPath, 'utf8');

    const headBefore = await getHeadCommit(repository.path);

    await writeFile(
      join(repository.path, 'unrelated.txt'),
      'Unrelated change\n',
      'utf8',
    );

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
    ).rejects.toThrow(
      'Finding resolution requires no changes outside its protocol files.',
    );

    await expect(readFile(statePath, 'utf8')).resolves.toBe(stateBefore);
    await expect(readFile(handoffPath, 'utf8')).resolves.toBe(handoffBefore);
    await expect(getHeadCommit(repository.path)).resolves.toBe(headBefore);
  });

  it('given an invalid handoff specId when all findings are rejected then no protocol write occurs', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const statePath = paths.getWorkflowPath(SPEC_ID);
    const handoffPath = paths.getVerifierHandoffPath(SPEC_ID);
    const handoff = await readCurrentHandoff(paths);
    await writeFile(
      handoffPath,
      JSON.stringify({ ...handoff, specId: '20260321-143052-other-spec' }),
      'utf8',
    );
    await repository.commit('Invalid verifier handoff');
    const stateBefore = await readFile(statePath, 'utf8');
    const handoffBefore = await readFile(handoffPath, 'utf8');

    const headBefore = await getHeadCommit(repository.path);

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
    await expect(getHeadCommit(repository.path)).resolves.toBe(headBefore);
  });

  it('given an invalid handoff revision when all findings are rejected then no protocol write occurs', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const statePath = paths.getWorkflowPath(SPEC_ID);
    const handoffPath = paths.getVerifierHandoffPath(SPEC_ID);
    const handoff = await readCurrentHandoff(paths);
    await writeFile(
      handoffPath,
      JSON.stringify({ ...handoff, revision: 1 }),
      'utf8',
    );
    await repository.commit('Invalid verifier handoff');
    const stateBefore = await readFile(statePath, 'utf8');
    const handoffBefore = await readFile(handoffPath, 'utf8');

    const headBefore = await getHeadCommit(repository.path);

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
    ).rejects.toThrow('Verifier handoff revision mismatch');

    await expect(readFile(statePath, 'utf8')).resolves.toBe(stateBefore);
    await expect(readFile(handoffPath, 'utf8')).resolves.toBe(handoffBefore);
    await expect(getHeadCommit(repository.path)).resolves.toBe(headBefore);
  });

  it('given an empty rejection reason when resolving findings then no protocol write occurs', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const statePath = paths.getWorkflowPath(SPEC_ID);
    const handoffPath = paths.getVerifierHandoffPath(SPEC_ID);
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

  it('given a commit hook that changes the product when findings are rejected then resolution does not report success', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    await writeFile(
      join(repository.path, '.git/hooks/post-commit'),
      '#!/bin/sh\nprintf "Changed by hook\\n" >> README.md\n',
      { mode: 0o755 },
    );

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
    ).rejects.toThrow(
      'Finding resolution requires a clean checkout after its commit.',
    );

    await expect(getRepositoryStatus(repository.path)).resolves.toMatchObject({
      clean: false,
      unstaged: ['README.md'],
    });
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
  });

  it('bypasses finding resolution when the owner revises the spec', async () => {
    const { paths, repository } = await createFindingsDecisionWorkflow([
      createFinding('F1'),
    ]);

    const stateBefore = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));

    const handoffBefore = await readCurrentHandoff(paths);
    const headBefore = await getHeadCommit(repository.path);
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
    await expect(getHeadCommit(repository.path)).resolves.toBe(headBefore);
    await expect(readCurrentHandoff(paths)).rejects.toThrow(
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
