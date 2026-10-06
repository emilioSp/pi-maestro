import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { FINDING_SEVERITIES } from '#artifacts/verifier-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import { getParentCommit } from '#git/history/getParentCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { registerRecordVerifierHandoffTool } from '#tools/child/record-verifier-handoff.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

const createHandoffInput = () => ({
  specId: SPEC_ID,
  summary: 'The candidate satisfies the approved specification.',
  acceptanceCriteria: [],
  findings: [],
  notes: [],
});

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('verifier handoff tool', () => {
  it('registers a closed input schema with explicit verifier identity', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerRecordVerifierHandoffTool,
    });

    const input = createHandoffInput();

    expect(Value.Check(tool.parameters, input)).toBe(true);
    expect(Value.Check(tool.parameters, { ...input, branch: 'main' })).toBe(
      false,
    );
    expect(
      Value.Check(tool.parameters, {
        ...input,
        findings: [
          {
            id: 'F1',
            acceptanceCriterion: null,
            severity: FINDING_SEVERITIES.HIGH,
            confidence: 1,
            summary: 'Finding',
            evidence: [{ source: 'test', observation: 'Observed' }],
            rejection: { reason: 'Rejected' },
          },
        ],
      }),
    ).toBe(false);
  });

  it('rejects a handoff outside the verifier-running phase', async () => {
    const workflow = await createApprovedWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    await expect(
      tool.execute('test-call', createHandoffInput()),
    ).rejects.toThrow(
      'Verifier handoff requires verifier-running state, found "ready-for-builder".',
    );
  });

  it('rejects a workflow spec identity mismatch', async () => {
    const workflow = await createApprovedWorkflow();
    const statePath = workflow.paths.getWorkflowPath(SPEC_ID);
    const state = await readWorkflowState(statePath);

    await writeFile(
      statePath,
      `${JSON.stringify(
        { ...state, specId: '20260321-143052-other-spec' },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    await expect(
      tool.execute('test-call', createHandoffInput()),
    ).rejects.toThrow(
      `Workflow spec ID mismatch: expected "${SPEC_ID}", found "20260321-143052-other-spec".`,
    );
  });

  it('given restored temporary product changes when the verifier records its handoff then only protocol files are committed', async () => {
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
        summary: 'Implemented the approved change.',
        acceptanceCriteria: [],
        notes: [],
      },
    });
    await workflow.repository.commit('Builder completed');

    const verifierRun = await prepareVerifierRun({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    const productPath = `${workflow.repository.path}/README.md`;
    const originalProduct = await readFile(productPath, 'utf8');
    await writeFile(productPath, '# Temporary breakage\n', 'utf8');
    await writeFile(productPath, originalProduct, 'utf8');

    const result = await tool.execute('test-call', createHandoffInput());

    expect(result.details).toMatchObject({
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      revision: verifierRun.revision + 1,
      specId: SPEC_ID,
    });
    await expect(
      readWorkflowState(workflow.paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
    await expect(
      getRepositoryStatus(workflow.repository.path),
    ).resolves.toMatchObject({
      clean: true,
      staged: [],
      unstaged: [],
      untracked: [],
    });

    const commitFiles = await runGitCommand({
      arguments: ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'],
      cwd: workflow.repository.path,
    });

    expect(commitFiles.stdout.trim().split(/\r?\n/).sort()).toEqual(
      [
        relative(
          workflow.repository.path,
          workflow.paths.getVerifierHandoffPath(SPEC_ID),
        ),
        relative(
          workflow.repository.path,
          workflow.paths.getWorkflowPath(SPEC_ID),
        ),
      ].sort(),
    );
    await expect(
      getParentCommit({
        repositoryRoot: workflow.repository.path,
        commit: 'HEAD',
      }),
    ).resolves.toBe(verifierRun.checkpointCommit);
  });

  it('given a commit hook that changes the product when the verifier records its handoff then the tool does not report success', async () => {
    const workflow = await createApprovedWorkflow();
    await prepareBuilderRun({ paths: workflow.paths, specId: SPEC_ID });
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
    await prepareVerifierRun({ paths: workflow.paths, specId: SPEC_ID });
    await writeFile(
      `${workflow.repository.path}/.git/hooks/post-commit`,
      '#!/bin/sh\nprintf "Changed by hook\\n" >> README.md\n',
      { mode: 0o755 },
    );

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    await expect(
      tool.execute('test-call', createHandoffInput()),
    ).rejects.toThrow(
      'Verifier handoff requires a clean checkout after its commit.',
    );
    await expect(
      getRepositoryStatus(workflow.repository.path),
    ).resolves.toMatchObject({ clean: false, unstaged: ['README.md'] });
  });
});
