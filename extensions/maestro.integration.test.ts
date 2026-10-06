/**
 * Objective: Check main Maestro registration and the current-checkout workflow.
 * Used: In integration tests with real Pi sessions and scripted child work.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type {
  ExtensionAPI,
  wrapRegisteredTool,
} from '@earendil-works/pi-coding-agent';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { Type } from 'typebox';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import { AGENTS } from '#config/schema.ts';
import maestroExtension from '#extensions/maestro.ts';
import maestroSubagentExtension from '#extensions/maestro-subagent.ts';
import { runGitCommand } from '#git/command.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MAESTRO_STATUS_KEY } from '#maestro/status/refreshMaestroStatus.ts';
import type { CreatedSpec } from '#specs/create.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  failedHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { BUILDER_HANDOFF_TOOL } from '#tools/child/record-builder-handoff.ts';
import { VERIFIER_HANDOFF_TOOL } from '#tools/child/record-verifier-handoff.ts';
import { CREATE_SPEC_TOOL } from '#tools/main/create-spec.ts';
import { MARK_SPEC_READY_TOOL } from '#tools/main/mark-spec-ready.ts';
import { RESOLVE_ESCALATION_TOOL } from '#tools/main/resolve-escalation.ts';
import { RESOLVE_FINDINGS_TOOL } from '#tools/main/resolve-findings.ts';
import { RUN_BUILDER_TOOL } from '#tools/main/run-builder.ts';
import { RUN_VERIFIER_TOOL } from '#tools/main/run-verifier.ts';
import { DELEGATION_STATUSES } from '#tools/utils/pi-subagent-delegation.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

const FOREIGN_TOOL = 'foreign_tool';

const MAIN_TOOL_NAMES = [
  CREATE_SPEC_TOOL.NAME,
  MARK_SPEC_READY_TOOL.NAME,
  RUN_BUILDER_TOOL.NAME,
  RESOLVE_ESCALATION_TOOL.NAME,
  RUN_VERIFIER_TOOL.NAME,
  RESOLVE_FINDINGS_TOOL.NAME,
];

const BASE_TOOLS = ['read', 'bash', 'edit', 'write', FOREIGN_TOOL];

const foreignExtension = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: FOREIGN_TOOL,
    label: 'Foreign tool',
    description: 'A tool owned by another extension.',
    parameters: Type.Object({}),
    execute: async () => ({ content: [], details: undefined }),
  });
};

type RegisteredTool = ReturnType<typeof wrapRegisteredTool>;

function assertToolRegistered(
  tool: RegisteredTool | undefined,
): asserts tool is RegisteredTool {
  if (tool === undefined) throw new Error('The tool is not active in Pi.');
}

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('main Maestro extension', () => {
  it('given startup when the extension loads then only main tools register once and Maestro stays silent and off', async () => {
    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      maestroAgentsAvailable: false,
    });

    expect(
      session.extensionRunner
        .getAllRegisteredTools()
        .map(({ definition }) => definition.name),
    ).toEqual([FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(maestroSessionState.isActive()).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections).toEqual({
      foreign: 'Keep foreign instructions',
    });
  });

  it('given valid checks when Maestro activates then tools instructions and status become available', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    await session.prompt('/maestro');

    expect(maestroSessionState.isActive()).toBe(true);
    expect(session.getActiveToolNames()).toEqual([
      ...BASE_TOOLS,
      ...MAIN_TOOL_NAMES,
    ]);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      'Maestro active · No active spec',
    );
    expect(notify).not.toHaveBeenCalled();

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections.maestro).toContain(
      'You are Maestro',
    );
    expect(event.systemPromptOptions.sections.foreign).toBe(
      'Keep foreign instructions',
    );
    expect(event.systemPromptOptions.sections.maestro).toContain(
      'there is no retry or spec revision from builder-failed',
    );

    setStatus.mockClear();
    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: FOREIGN_TOOL,
      toolCallId: 'foreign-call',
      input: {},
      content: [],
      details: undefined,
      isError: false,
    });
    expect(setStatus).not.toHaveBeenCalled();

    await session.prompt('/maestro');
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    expect(session.getActiveToolNames()).toEqual([
      ...BASE_TOOLS,
      ...MAIN_TOOL_NAMES,
    ]);
    expect(
      session.extensionRunner
        .getAllRegisteredTools()
        .map(({ definition }) => definition.name),
    ).toEqual([FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('given active Maestro when its agents become unavailable then turning off succeeds and the next activation fails', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);

    await writeFile(
      join(getAgentDir(), 'settings.json'),
      JSON.stringify({ packages: [] }),
    );
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(false);
    expect(notify).not.toHaveBeenCalled();

    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(false);
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenLastCalledWith(
      expect.stringContaining(`Unknown agent: ${AGENTS.BUILDER}`),
      'error',
    );
  });

  it('given a failed check when activation is retried then Maestro stays off and reports each error', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus, settingsManager } =
      await piTestSessions.create({
        extensions: [foreignExtension, maestroExtension],
        cwd: repository.path,
        projectTrusted: false,
      });

    await session.prompt('/maestro');
    await session.prompt('/maestro');

    expect(maestroSessionState.isActive()).toBe(false);
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenLastCalledWith(
      expect.stringContaining('Project is not trusted'),
      'error',
    );

    settingsManager.setProjectTrusted(true);
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('given an active spec when Maestro turns off then live state clears and current branch and files remain unchanged', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { session, notify, setStatus, settingsManager } =
      await piTestSessions.create({
        extensions: [foreignExtension, maestroExtension],
        cwd: repository.path,
      });

    await session.prompt('/maestro');
    maestroSessionState.setActiveSpecId(SPEC_ID);
    const specPath = paths.getSpecFilePath(SPEC_ID);
    await maestroSessionState.setSpecSha256(specPath);
    const spec = await readFile(specPath, 'utf8');
    const workflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');
    await runGitCommand({
      arguments: ['switch', '-c', 'owner-selected'],
      cwd: repository.path,
    });

    const head = await runGitCommand({
      arguments: ['rev-parse', 'HEAD'],
      cwd: repository.path,
    });

    const worktrees = await runGitCommand({
      arguments: ['worktree', 'list', '--porcelain'],
      cwd: repository.path,
    });

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(maestroSessionState.getSpecSha256()).not.toBeNull();

    session.setActiveToolsByName(['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    settingsManager.setProjectTrusted(false);
    await session.prompt('/maestro');

    const inactivePrompt = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      event.systemPromptOptions,
    );

    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(maestroSessionState.getSpecSha256()).toBeNull();
    expect(session.getActiveToolNames()).toEqual(['read', FOREIGN_TOOL]);
    expect(inactivePrompt.systemPromptOptions.sections).toEqual({
      foreign: 'Keep foreign instructions',
    });
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(notify).not.toHaveBeenCalled();
    expect(await readFile(specPath, 'utf8')).toBe(spec);
    expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(
      workflow,
    );
    expect(
      await runGitCommand({
        arguments: ['branch', '--show-current'],
        cwd: repository.path,
      }),
    ).toMatchObject({ stdout: 'owner-selected\n' });
    expect(
      await runGitCommand({
        arguments: ['rev-parse', 'HEAD'],
        cwd: repository.path,
      }),
    ).toEqual(head);
    expect(
      await runGitCommand({
        arguments: ['worktree', 'list', '--porcelain'],
        cwd: repository.path,
      }),
    ).toEqual(worktrees);

    settingsManager.setProjectTrusted(true);
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      'Maestro active · No active spec',
    );
    expect(session.getActiveToolNames()).toEqual([
      'read',
      FOREIGN_TOOL,
      ...MAIN_TOOL_NAMES,
    ]);
  });

  it('given an active workflow when a session resumes then Maestro stays off without recovering the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await maestroSessionState.setSpecSha256(paths.getSpecFilePath(SPEC_ID));
    const workflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
      sessionStartEvent: { type: 'session_start', reason: 'resume' },
      maestroAgentsAvailable: false,
    });

    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(maestroSessionState.getSpecSha256()).toBeNull();
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(notify).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(
      workflow,
    );
  });

  it('given an approved spec on the current branch when builder and verifier finish then Maestro reaches candidate-ready without a final checkpoint', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    await runGitCommand({
      arguments: ['switch', '-c', 'feature/test'],
      cwd: repository.path,
    });

    const { session, events, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    await session.prompt('/maestro');

    const createSpecTool = session.agent.state.tools.find(
      (tool) => tool.name === CREATE_SPEC_TOOL.NAME,
    );

    assertToolRegistered(createSpecTool);

    const created = await createSpecTool.execute('test-call', {
      title: 'Add Weather Alerts',
    });

    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: CREATE_SPEC_TOOL.NAME,
      toolCallId: 'test-call',
      input: { title: 'Add Weather Alerts' },
      ...created,
      isError: false,
    });

    // JUSTIFICATION: The registered create-spec tool returns CreatedSpec details.
    const { specId, specPath, specFilePath, workflowPath } =
      created.details as CreatedSpec;

    expect(maestroSessionState.getActiveSpecId()).toBe(specId);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      `Maestro active · ${specId} · Preparing specification`,
    );

    const approvedSpec = (
      await readFile(
        new URL(import.meta.resolve('#test/fixtures/weather-alert-spec.md')),
        'utf8',
      )
    ).replace('<id>', specId);

    await writeFile(specFilePath, approvedSpec);

    const markSpecReadyTool = session.agent.state.tools.find(
      (tool) => tool.name === MARK_SPEC_READY_TOOL.NAME,
    );

    assertToolRegistered(markSpecReadyTool);
    const approved = await markSpecReadyTool.execute('test-call', { specId });
    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: MARK_SPEC_READY_TOOL.NAME,
      toolCallId: 'test-call',
      input: { specId },
      ...approved,
      isError: false,
    });

    expect(approved.details).toMatchObject({
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      `Maestro active · ${specId} · Ready for builder`,
    );
    await repository.commit('Approve weather alerts specification');

    const productPath = join(repository.path, 'alert.txt');
    const productContents = 'Weather alerts enabled\n';

    const acceptanceCriteria = [
      {
        id: 'AC1',
        probe: 'Read alert.txt and compare it with Weather alerts enabled\\n.',
        probeStatus: PROBE_STATUSES.PASSED,
        breakageStatus: BREAKAGE_STATUSES.CONFIRMED,
      },
    ];

    const requests: SubagentDelegationRequest[] = [];
    const childCommits: string[] = [];
    const runCommits: string[] = [];

    // Script only the AI work and completion response. Pi sessions, tools, and Git are real.
    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The registered run tools emit delegation requests on this channel.
      const request = payload as SubagentDelegationRequest;
      requests.push(request);

      try {
        runCommits.push(await getHeadCommit(repository.path));

        const { session: child } = await piTestSessions.create({
          cwd: request.cwd,
          extensions: [maestroSubagentExtension],
        });

        expect([AGENTS.BUILDER, AGENTS.VERIFIER]).toContain(request.agent);

        if (request.agent === AGENTS.BUILDER) {
          await writeFile(productPath, productContents);
        }

        const toolName =
          request.agent === AGENTS.BUILDER
            ? BUILDER_HANDOFF_TOOL.NAME
            : VERIFIER_HANDOFF_TOOL.NAME;

        const tool = child.agent.state.tools.find(
          (tool) => tool.name === toolName,
        );

        assertToolRegistered(tool);
        await tool.execute(request.requestId, {
          specId,
          summary:
            'The weather alert message passed the probe and breakage checks.',
          acceptanceCriteria,
          notes: [],
          ...(request.agent === AGENTS.BUILDER
            ? { status: BUILDER_HANDOFF_STATUSES.DONE }
            : { findings: [] }),
        });

        if (request.agent === AGENTS.BUILDER) {
          await repository.commit('Implement weather alerts');
        }

        childCommits.push(await getHeadCommit(repository.path));

        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: DELEGATION_STATUSES.COMPLETED,
          result: { kind: 'text', text: 'The scripted child work finished.' },
        });
      } catch (error) {
        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: DELEGATION_STATUSES.FAILED,
          error: String(error),
        });
      }
    });

    const runBuilderTool = session.agent.state.tools.find(
      (tool) => tool.name === RUN_BUILDER_TOOL.NAME,
    );

    assertToolRegistered(runBuilderTool);
    const built = await runBuilderTool.execute('test-call', { specId });
    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: RUN_BUILDER_TOOL.NAME,
      toolCallId: 'test-call',
      input: { specId },
      ...built,
      isError: false,
    });

    expect(built.details).toMatchObject({
      specId,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
      revision: 4,
      handoff: { specId, revision: 4, status: BUILDER_HANDOFF_STATUSES.DONE },
    });

    const runVerifierTool = session.agent.state.tools.find(
      (tool) => tool.name === RUN_VERIFIER_TOOL.NAME,
    );

    assertToolRegistered(runVerifierTool);
    const verified = await runVerifierTool.execute('test-call', { specId });
    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: RUN_VERIFIER_TOOL.NAME,
      toolCallId: 'test-call',
      input: { specId },
      ...verified,
      isError: false,
    });

    expect(verified.details).toMatchObject({
      specId,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      revision: 6,
      candidateCommit: runCommits[1],
      checkpointCommit: runCommits[1],
      handoff: { specId, revision: 6, acceptanceCriteria, findings: [] },
    });
    expect(requests).toMatchObject([
      {
        agent: AGENTS.BUILDER,
        cwd: repository.path,
        context: 'fresh',
        task: expect.stringContaining(specId),
      },
      {
        agent: AGENTS.VERIFIER,
        cwd: repository.path,
        context: 'fresh',
        task: expect.stringContaining(specId),
      },
    ]);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      `Maestro active · ${specId} · Completed`,
    );

    const state = await readWorkflowState(workflowPath);
    expect(state).toMatchObject({
      specId,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      revision: 6,
    });
    const verifierHandoffPath = join(specPath, 'handoffs', 'verifier.json');
    expect(
      await readVerifierHandoff({
        path: verifierHandoffPath,
        specId,
        revision: state.revision,
      }),
    ).toMatchObject({ specId, revision: 6, acceptanceCriteria, findings: [] });
    expect(
      await runGitCommand({
        arguments: ['show', '--format=', '--name-only', 'HEAD'],
        cwd: repository.path,
      }),
    ).toMatchObject({
      stdout: `${[
        relative(repository.path, verifierHandoffPath),
        relative(repository.path, workflowPath),
      ]
        .sort()
        .join('\n')}\n`,
    });
    expect(await readFile(specFilePath, 'utf8')).toBe(approvedSpec);
    expect(await readFile(productPath, 'utf8')).toBe(productContents);

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections.maestro).toContain(
      'You own the final summary.',
    );
    expect(event.systemPromptOptions.sections.maestro).toContain(
      'No final tool call, checkpoint, or owner commit is required.',
    );
    expect(await getHeadCommit(repository.path)).toBe(childCommits[1]);
    expect(await getRepositoryStatus(repository.path)).toMatchObject({
      clean: true,
    });
    expect(
      await runGitCommand({
        arguments: ['branch', '--show-current'],
        cwd: repository.path,
      }),
    ).toMatchObject({ stdout: 'feature/test\n' });
  });

  it.each([
    WORKFLOW_PHASES.ESCALATION_DECISION,
    WORKFLOW_PHASES.FINDINGS_DECISION,
  ])(
    'given %s when the owner approves a spec revision then the registered tool returns ready-for-builder on the same branch',
    async (phase) => {
      const { paths, repository } = await createApprovedWorkflow();

      const current = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));

      await writeWorkflowState({
        path: paths.getWorkflowPath(SPEC_ID),
        state: { ...current, revision: current.revision + 1, phase },
        currentRevision: current.revision,
      });
      await writeFile(
        paths.getSpecFilePath(SPEC_ID),
        '# Owner-approved revised contract\n',
        'utf8',
      );

      const { session, setStatus } = await piTestSessions.create({
        extensions: [foreignExtension, maestroExtension],
        cwd: repository.path,
      });

      await session.prompt('/maestro');
      maestroSessionState.setActiveSpecId(SPEC_ID);

      const markSpecReadyTool = session.agent.state.tools.find(
        (tool) => tool.name === MARK_SPEC_READY_TOOL.NAME,
      );

      assertToolRegistered(markSpecReadyTool);

      const result = await markSpecReadyTool.execute('test-call', {
        specId: SPEC_ID,
      });

      await session.extensionRunner.emitToolResult({
        type: 'tool_result',
        toolName: MARK_SPEC_READY_TOOL.NAME,
        toolCallId: 'test-call',
        input: { specId: SPEC_ID },
        ...result,
        isError: false,
      });

      expect(result.details).toMatchObject({
        specId: SPEC_ID,
        phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
        revision: current.revision + 2,
      });
      expect(setStatus).toHaveBeenLastCalledWith(
        MAESTRO_STATUS_KEY,
        `Maestro active · ${SPEC_ID} · Ready for builder`,
      );
      expect(
        await runGitCommand({
          arguments: ['branch', '--show-current'],
          cwd: repository.path,
        }),
      ).toMatchObject({ stdout: 'main\n' });
    },
  );

  it('given a committed builder failure when the registered run tool returns then the owner receives the failure and status updates', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { session, events, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    maestroSessionState.setActiveSpecId(SPEC_ID);
    const requests: SubagentDelegationRequest[] = [];
    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: This listener receives the request emitted by the registered run tool.
      const request = payload as SubagentDelegationRequest;
      requests.push(request);

      try {
        await completeBuilderPass({
          paths,
          specId: SPEC_ID,
          handoff: failedHandoff(3),
        });
        await repository.commit('Builder failure handoff');
        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: DELEGATION_STATUSES.COMPLETED,
          result: { kind: 'text', text: 'The builder failed.' },
        });
      } catch (error) {
        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: DELEGATION_STATUSES.FAILED,
          error: String(error),
        });
      }
    });

    const runBuilderTool = session.agent.state.tools.find(
      (tool) => tool.name === RUN_BUILDER_TOOL.NAME,
    );

    assertToolRegistered(runBuilderTool);

    const result = await runBuilderTool.execute('test-call', {
      specId: SPEC_ID,
    });

    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: RUN_BUILDER_TOOL.NAME,
      toolCallId: 'test-call',
      input: { specId: SPEC_ID },
      ...result,
      isError: false,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      cwd: repository.path,
      context: 'fresh',
    });
    expect(result.details).toMatchObject({
      phase: WORKFLOW_PHASES.BUILDER_FAILED,
      handoff: { failure: { reason: 'The implementation was blocked.' } },
    });
    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('cannot be retried') },
    ]);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      `Maestro active · ${SPEC_ID} · Builder failed`,
    );
  });

  it('given a missing active workflow when status refreshes then it reports an error without blocking instructions', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections.maestro).toContain(
      'You are Maestro',
    );
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining('ENOENT'),
      'error',
    );
  });
});
