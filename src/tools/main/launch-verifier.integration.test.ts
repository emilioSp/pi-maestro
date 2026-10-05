import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { AGENTS } from '#config/schema.ts';
import { createWorkflowCheckpointCommit } from '#git/commits/createWorkflowCheckpointCommit.ts';
import { getParentCommit } from '#git/history/getParentCommit.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { registerLaunchVerifierTool } from '#tools/main/launch-verifier.ts';
import { DELEGATION_STATUSES } from '#tools/utils/pi-subagent-delegation.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import {
  completeVerifierPass,
  VERIFIER_PASS_ERRORS,
} from '#workflow/verifier/completeVerifierPass.ts';

const createReadyForVerifierWorkflow = async () => {
  const workflow = await createApprovedWorkflow();

  const builderLaunch = await prepareBuilderLaunch({
    paths: workflow.paths,
    specId: SPEC_ID,
  });

  await completeBuilderPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: {
      status: 'done',
      summary: 'The approved change was implemented.',
      acceptanceCriteria: [],
      notes: [],
    },
  });
  await workflow.repository.commit({
    message: `Builder completed at revision ${builderLaunch.revision + 1}`,
  });

  return workflow;
};

const getCurrentCandidate = async (repositoryRoot: string): Promise<string> =>
  getParentCommit({
    repositoryRoot,
    commit: await getHeadCommit({ repositoryRoot }),
  });

type VerifierHandoffInput = {
  revision: number;
  findings?: readonly unknown[];
};

const createVerifierHandoff = ({
  revision,
  findings = [],
}: VerifierHandoffInput) => ({
  version: VERIFIER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision,
  summary: 'The candidate was independently verified.',
  acceptanceCriteria: [],
  findings,
  notes: [],
});

const recordVerifierHandoff = async ({
  repositoryRoot,
  paths,
  findings = [],
}: {
  repositoryRoot: string;
  paths: MaestroPaths;
  findings?: readonly unknown[];
}): Promise<void> => {
  const state = await readWorkflowState({
    path: paths.getWorkflowPath(SPEC_ID),
  });

  const completed = await completeVerifierPass({
    paths,
    specId: SPEC_ID,
    candidateCommit: await getCurrentCandidate(repositoryRoot),
    handoff: createVerifierHandoff({
      revision: state.revision + 1,
      findings,
    }),
  });

  if ('error' in completed) {
    throw new Error(completed.message);
  }

  await createWorkflowCheckpointCommit({
    repositoryRoot,
    expectedPaths: [
      paths.getWorkflowPath(SPEC_ID),
      paths.getVerifierHandoffPath(SPEC_ID),
    ],
  });
};

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('launch verifier tool', () => {
  it('registers a closed spec-only input schema', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerLaunchVerifierTool,
    });

    expect(Value.Check(tool.parameters, { specId: SPEC_ID })).toBe(true);
    expect(Value.Check(tool.parameters, {})).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        branch: 'main',
        worktree: '/tmp/worktree',
        verifierPass: 1,
      }),
    ).toBe(false);
  });

  it('launches the verifier in the current checkout with explicit spec identity', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, emit, on } =
      await piTestSessions.createRegisteredTool({
        cwd: workflow.repository.path,
        extension: registerLaunchVerifierTool,
      });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: 'other-request',
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'completed',
        result: { kind: 'text', text: 'Ignore this response.' },
      });

      await recordVerifierHandoff({
        repositoryRoot: workflow.repository.path,
        paths: workflow.paths,
      });
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The verifier finished.' },
      });
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    const receivedRequest = emit.mock.calls[0][1];
    expect(receivedRequest).toMatchObject({
      agent: AGENTS.VERIFIER,
      nodeId: 'verifier',
      context: 'fresh',
      cwd: workflow.repository.path,
      model: 'openai-codex/gpt-6-sol',
      thinking: 'medium',
      timeoutMs: 60 * 60 * 1000,
      task: expect.stringContaining(SPEC_ID),
      result: { kind: 'text' },
    });
    expect(receivedRequest).toMatchObject({
      task: expect.stringContaining(workflow.repository.path),
    });
    expect(receivedRequest).toMatchObject({
      task: expect.stringContaining('AGENTS.md'),
    });
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
    expect(result.details).toMatchObject({
      outcome: WORKFLOW_PHASES.CANDIDATE_READY,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
  });

  it('returns findings and cleans the response listener', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerLaunchVerifierTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      await recordVerifierHandoff({
        repositoryRoot: workflow.repository.path,
        paths: workflow.paths,
        findings: [
          {
            id: 'F1',
            acceptanceCriterion: null,
            severity: 'medium',
            confidence: 1,
            summary: 'The verifier found a problem.',
            evidence: [
              { source: 'test', observation: 'The problem was observed.' },
            ],
            rejection: null,
          },
        ],
      });
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The verifier finished.' },
      });
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    expect(result.details).toMatchObject({
      outcome: WORKFLOW_PHASES.FINDINGS_DECISION,
      phase: WORKFLOW_PHASES.FINDINGS_DECISION,
      handoff: { findings: [{ id: 'F1' }] },
    });
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
  });

  it('returns product changes without advancing the workflow', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerLaunchVerifierTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      await writeFile(
        join(workflow.repository.path, 'README.md'),
        '# Changed\n',
      );

      const state = await readWorkflowState({
        path: workflow.paths.getWorkflowPath(SPEC_ID),
      });

      const completed = await completeVerifierPass({
        paths: workflow.paths,
        specId: SPEC_ID,
        candidateCommit: await getCurrentCandidate(workflow.repository.path),
        handoff: createVerifierHandoff({ revision: state.revision + 1 }),
      });

      expect(completed).toMatchObject({
        error: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
      });
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The verifier finished.' },
      });
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    expect(result.details).toMatchObject({
      outcome: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
      error: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });
    await expect(
      readWorkflowState({ path: workflow.paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.VERIFIER_RUNNING });
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
  });

  it('returns a workflow error before delegation', async () => {
    const workflow = await createApprovedWorkflow();

    const { tool, emit, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerLaunchVerifierTool,
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow(
      'Verifier launch requires ready-for-verifier state, found "ready-for-builder".',
    );
    expect(emit).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
  });

  it('returns a delegation error without advancing the workflow', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerLaunchVerifierTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'failed',
        error: 'The configured provider is unavailable.',
      });
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow(
      'Delegation error: The configured provider is unavailable.',
    );
    await expect(
      readWorkflowState({ path: workflow.paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.VERIFIER_RUNNING });
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
  });

  it('returns timeout and interruption errors distinctly', async () => {
    const timeoutWorkflow = await createReadyForVerifierWorkflow();

    const timeoutTool = await piTestSessions.createRegisteredTool({
      cwd: timeoutWorkflow.repository.path,
      extension: registerLaunchVerifierTool,
    });

    timeoutTool.events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      timeoutTool.events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'timed_out',
        error: 'The verifier exceeded its timeout.',
      });
    });

    await expect(
      timeoutTool.tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow('Delegation timeout: The verifier exceeded its timeout.');

    const interruptionWorkflow = await createReadyForVerifierWorkflow();

    const interruptionTool = await piTestSessions.createRegisteredTool({
      cwd: interruptionWorkflow.repository.path,
      extension: registerLaunchVerifierTool,
    });

    interruptionTool.events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      interruptionTool.events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'interrupted',
        error: 'The verifier was interrupted.',
      });
    });

    await expect(
      interruptionTool.tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow('Delegation interruption: The verifier was interrupted.');
  });

  it('returns a protocol error when a completed response has no handoff', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerLaunchVerifierTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The verifier finished.' },
      });
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow(
      'Verifier protocol error: The verifier returned without recording a valid terminal handoff.',
    );
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
    await expect(
      access(workflow.paths.getVerifierHandoffPath(SPEC_ID)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
