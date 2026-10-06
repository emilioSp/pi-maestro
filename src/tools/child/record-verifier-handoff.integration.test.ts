import { access, readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { FINDING_SEVERITIES } from '#artifacts/verifier-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import { getParentCommit } from '#git/history/getParentCommit.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
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
    maestroSessionState.setVerifierCheckpointCommit(
      await getHeadCommit(workflow.repository.path),
    );

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
    maestroSessionState.setVerifierCheckpointCommit(
      await getHeadCommit(workflow.repository.path),
    );

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
      candidateCommit: verifierRun.candidateCommit,
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

  it('given no live verifier checkpoint when the verifier records its handoff then no protocol files are written or committed', async () => {
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

    const run = await prepareVerifierRun({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    maestroSessionState.clearVerifierCheckpointCommit();
    const workflowPath = workflow.paths.getWorkflowPath(SPEC_ID);
    const workflowBefore = await readFile(workflowPath, 'utf8');

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    await expect(
      tool.execute('test-call', createHandoffInput()),
    ).rejects.toThrow('Verifier handoff requires a live verifier checkpoint.');
    await expect(getHeadCommit(workflow.repository.path)).resolves.toBe(
      run.checkpointCommit,
    );
    await expect(readFile(workflowPath, 'utf8')).resolves.toBe(workflowBefore);
    await expect(
      access(workflow.paths.getVerifierHandoffPath(SPEC_ID)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('given product changes committed after the run starts when the verifier records its handoff then the checkpoint baseline does not move', async () => {
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

    const run = await prepareVerifierRun({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    await writeFile(
      `${workflow.repository.path}/README.md`,
      '# Changed product\n',
      'utf8',
    );
    await workflow.repository.commit(
      'Change product after the verifier run starts',
    );
    await runGitCommand({
      arguments: ['commit', '--allow-empty', '-m', 'Advance HEAD again'],
      cwd: workflow.repository.path,
    });
    const headBefore = await getHeadCommit(workflow.repository.path);
    const workflowPath = workflow.paths.getWorkflowPath(SPEC_ID);
    const workflowBefore = await readFile(workflowPath, 'utf8');

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    const result = await tool.execute('test-call', createHandoffInput());

    expect(result.details).toMatchObject({ error: 'PRODUCT_FILES_MODIFIED' });
    expect(maestroSessionState.getVerifierCheckpointCommit()).toBe(
      run.checkpointCommit,
    );
    await expect(getHeadCommit(workflow.repository.path)).resolves.toBe(
      headBefore,
    );
    await expect(readFile(workflowPath, 'utf8')).resolves.toBe(workflowBefore);
    await expect(
      access(workflow.paths.getVerifierHandoffPath(SPEC_ID)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects product changes without writing or committing protocol files', async () => {
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
    await prepareVerifierRun({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    const headBefore = await getHeadCommit(workflow.repository.path);

    await writeFile(
      `${workflow.repository.path}/README.md`,
      '# Changed product\n',
      'utf8',
    );

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    const result = await tool.execute('test-call', createHandoffInput());

    expect(result).toMatchObject({
      details: {
        error: 'PRODUCT_FILES_MODIFIED',
      },
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Product files differ from the candidate commit. Restore the candidate before submitting the verifier handoff.',
      },
    ]);
    await expect(getHeadCommit(workflow.repository.path)).resolves.toBe(
      headBefore,
    );
    await expect(
      readWorkflowState(workflow.paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.VERIFIER_RUNNING });
    await expect(
      access(workflow.paths.getVerifierHandoffPath(SPEC_ID)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
