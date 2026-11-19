/**
 * Objective: Verify workflow execution and status through the registered Maestro extension.
 * Used: In integration tests with real offline Pi sessions.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createAgentSession, SessionManager } from '@earendil-works/pi-coding-agent';
import { afterEach, expect, it, vi, onTestFinished } from 'vitest';

import { BUILDER_HANDOFF_STATUSES, PROBE_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { readSimplifierHandoff } from '#artifacts/simplifier-handoff/readSimplifierHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import {
  FINDING_DECISIONS,
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
} from '#artifacts/verifier-handoff/schema.ts';
import { saveConfiguration } from '#config/saveConfiguration.ts';
import maestroExtension from '#extensions/maestro.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MAESTRO_STATUS_KEY } from '#maestro/status/refreshMaestroStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import type { CreatedSpec } from '#specs/create.ts';
import { executeTask, type ExecuteTaskInput } from '#src/delegation/executeTask.ts';
import { prepareSubagentEnvironment } from '#src/delegation/prepareSubagentEnvironment.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { unavailableCompilerEscalation } from '#tests/fixtures/unavailable-compiler-escalation.ts';
import { createApprovedWorkflow, doneHandoff, SPEC_ID } from '#tests/support/builder-workflow.ts';
import {
  assertToolRegistered,
  chooseNewSpec,
  foreignExtension,
} from '#tests/support/maestro-extension.ts';
import * as piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject, initTestGitRepository } from '#tests/support/temp-repository.ts';
import { BUILDER_HANDOFF_TOOL } from '#tools/child/record-builder-handoff.ts';
import { SIMPLIFIER_HANDOFF_TOOL } from '#tools/child/record-simplifier-handoff.ts';
import { VERIFIER_HANDOFF_TOOL } from '#tools/child/record-verifier-handoff.ts';
import { CREATE_SPEC_TOOL } from '#tools/main/create-spec.ts';
import { MARK_SPEC_READY_TOOL } from '#tools/main/mark-spec-ready.ts';
import { RESOLVE_ESCALATIONS_TOOL } from '#tools/main/resolve-escalations.ts';
import { RESOLVE_FINDINGS_TOOL } from '#tools/main/resolve-findings.ts';
import { RUN_BUILDER_TOOL } from '#tools/main/run-builder.ts';
import { RUN_SIMPLIFIER_TOOL } from '#tools/main/run-simplifier.ts';
import { RUN_VERIFIER_TOOL } from '#tools/main/run-verifier.ts';
import { SCORE_WORKFLOW_TOOL } from '#tools/main/score-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

vi.mock('#src/delegation/executeTask.ts', () => ({ executeTask: vi.fn<typeof executeTask>() }));

afterEach(() => {
  vi.mocked(executeTask).mockReset();
  maestroSessionState.deactivate();
});

it('GIVEN an approved proposal, nested-criteria spec, and design in Git WHEN builder, verifier, and simplifier finish THEN the workflow ends at candidate-ready with saved reports and unchanged approved documents', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await initTestGitRepository(repository.path);
  await saveConfiguration({
    cwd: repository.path,
    agentModelSelections: {
      builder: TEST_CONFIG.builder,
      verifier: TEST_CONFIG.verifier,
      simplifier: TEST_CONFIG.simplifier,
      scorer: TEST_CONFIG.scorer,
    },
  });

  const { session, setStatus } = await piTestSessions.create({
    extensions: [foreignExtension, maestroExtension],
    cwd: repository.path,
  });

  chooseNewSpec(session);
  await session.prompt('/maestro');
  const theme = session.extensionRunner.createContext().ui.theme;

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
  const { specId, specPath, proposalFilePath, specFilePath, designFilePath, workflowPath } =
    created.details as CreatedSpec;

  expect(maestroSessionState.getActiveSpecId()).toBe(specId);
  expect(specPath).toBe(join(repository.path, '.specs', specId));
  expect(await readWorkflowState(workflowPath)).toMatchObject({ specId });
  expect(setStatus).toHaveBeenLastCalledWith(
    MAESTRO_STATUS_KEY,
    theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
      '📝 ' +
      theme.fg('accent', 'Preparing specification'),
  );

  const approvedSpec = (
    await readFile(new URL(import.meta.resolve('#tests/fixtures/weather-alert-spec.md')), 'utf8')
  ).replace('<id>', specId);

  const approvedProposal = (
    await readFile(
      new URL(import.meta.resolve('#tests/fixtures/weather-alert-proposal.md')),
      'utf8',
    )
  ).replace('<id>', specId);

  const approvedDesign = (
    await readFile(new URL(import.meta.resolve('#tests/fixtures/weather-alert-design.md')), 'utf8')
  ).replace('<id>', specId);

  await writeFile(proposalFilePath, approvedProposal);
  await writeFile(specFilePath, approvedSpec);
  await writeFile(designFilePath, approvedDesign);

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
    theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
      '🚧 ' +
      theme.fg('accent', 'Ready for builder'),
  );

  const acceptanceCriteria = [
    {
      id: 'AC1',
      probe: 'Read alert.txt and compare it with Weather alerts enabled\\n.',
      probeStatus: PROBE_STATUSES.PASSED,
    },
  ];

  const scriptedRuns = [
    {
      heading: '# Builder',
      runningPhase: WORKFLOW_PHASES.BUILDER_RUNNING,
      statusIcon: '🛠️',
      statusLabel: 'Builder running',
      handoffToolName: BUILDER_HANDOFF_TOOL.NAME,
      handoff: {
        specId,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        summary: 'The weather alert message passed the probe.',
        acceptanceCriteria,
        escalations: [],
        notes: [],
      },
    },
    {
      heading: '# Verifier',
      runningPhase: WORKFLOW_PHASES.VERIFIER_RUNNING,
      statusIcon: '🔍',
      statusLabel: 'Verifier running',
      handoffToolName: VERIFIER_HANDOFF_TOOL.NAME,
      handoff: {
        specId,
        summary: 'The weather alert message passed the probe.',
        acceptanceCriteria,
        findings: [],
        notes: [],
      },
    },
    {
      heading: '# Simplifier',
      runningPhase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
      statusIcon: '🧹',
      statusLabel: 'Simplifier running',
      handoffToolName: SIMPLIFIER_HANDOFF_TOOL.NAME,
      handoff: {
        specId,
        refactoredFiles: [],
        summary: 'No simplification needed.',
        notes: [],
      },
    },
  ];

  // Script only the AI work and completion response. Pi sessions, tools, and file operations are real.
  vi.mocked(executeTask).mockImplementation(async (request) => {
    const services = await prepareSubagentEnvironment({
      cwd: request.cwd,
      roleGuidance: request.roleGuidance,
      additionalTools: request.additionalTools,
    });

    const { session: child } = await createAgentSession({
      ...services,
      modelRuntime: session.modelRuntime,
      model: session.model,
      sessionManager: SessionManager.inMemory(request.cwd),
    });

    try {
      await child.bindExtensions({ mode: 'print' });
      expect(child.systemPrompt).toContain(request.roleGuidance);
      expect(child.systemPrompt).toContain('You are a coding assistant running inside pi');

      const scriptedRun = scriptedRuns.find(({ heading }) =>
        request.roleGuidance.startsWith(heading),
      );

      if (scriptedRun === undefined) {
        throw new Error(`Unexpected agent: ${request.roleGuidance.split('\n')[0]}`);
      }

      expect(
        child.extensionRunner
          .getAllRegisteredTools()
          .map(({ definition }) => definition.name)
          .filter((name) => name.startsWith('maestro_record_')),
      ).toEqual([scriptedRun.handoffToolName]);
      expect(
        child.getActiveToolNames().filter((name) => name.startsWith('maestro_record_')),
      ).toEqual([scriptedRun.handoffToolName]);

      await expect(readWorkflowState(workflowPath)).resolves.toMatchObject({
        phase: scriptedRun.runningPhase,
      });
      expect(setStatus).toHaveBeenLastCalledWith(
        MAESTRO_STATUS_KEY,
        theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
          `${scriptedRun.statusIcon} ` +
          theme.fg('accent', scriptedRun.statusLabel),
      );

      const tool = child.agent.state.tools.find(
        (tool) => tool.name === scriptedRun.handoffToolName,
      );

      assertToolRegistered(tool);
      await tool.execute('scripted-handoff', scriptedRun.handoff);

      return { text: 'The scripted child work finished.' };
    } finally {
      await child.abort();
      await child.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      child.dispose();
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
    handoff: {
      specId,
      acceptanceCriteria,
      status: BUILDER_HANDOFF_STATUSES.DONE,
      escalations: [],
    },
  });
  expect(setStatus).toHaveBeenLastCalledWith(
    MAESTRO_STATUS_KEY,
    theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
      '📋 ' +
      theme.fg('accent', 'Ready for verifier'),
  );

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
    phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
    handoff: { specId, acceptanceCriteria, findings: [] },
  });
  expect(setStatus).toHaveBeenLastCalledWith(
    MAESTRO_STATUS_KEY,
    theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
      '🧹 ' +
      theme.fg('accent', 'Simplifier running'),
  );

  const runSimplifierTool = session.agent.state.tools.find(
    (tool) => tool.name === RUN_SIMPLIFIER_TOOL.NAME,
  );

  assertToolRegistered(runSimplifierTool);
  const simplified = await runSimplifierTool.execute('test-call', { specId });
  expect(simplified.details).toMatchObject({
    specId,
    phase: WORKFLOW_PHASES.SCORER_RUNNING,
    handoff: {
      specId,
      refactoredFiles: [],
      summary: 'No simplification needed.',
      notes: [],
    },
  });
  await session.extensionRunner.emitToolResult({
    type: 'tool_result',
    toolName: RUN_SIMPLIFIER_TOOL.NAME,
    toolCallId: 'test-call',
    input: { specId },
    ...simplified,
    isError: false,
  });
  expect(maestroSessionState.isWaitingForFinalResponse()).toBe(false);
  vi.spyOn(session.modelRuntime, 'getModelOfType').mockReturnValue(undefined);

  const scoreTool = session.agent.state.tools.find(
    (tool) => tool.name === SCORE_WORKFLOW_TOOL.NAME,
  );

  assertToolRegistered(scoreTool);
  const scored = await scoreTool.execute('score', { specId });
  await session.extensionRunner.emitToolResult({
    type: 'tool_result',
    toolName: SCORE_WORKFLOW_TOOL.NAME,
    toolCallId: 'score',
    input: { specId },
    ...scored,
    isError: false,
  });
  expect(setStatus).toHaveBeenLastCalledWith(
    MAESTRO_STATUS_KEY,
    theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
      '✅ ' +
      theme.fg('success', 'Completed'),
  );

  const state = await readWorkflowState(workflowPath);
  expect(state).toMatchObject({
    specId,
    phase: WORKFLOW_PHASES.CANDIDATE_READY,
  });

  const verifierHandoffPath = join(specPath, 'handoffs', 'verifier', 'V1.json');

  expect(
    await readVerifierHandoff({
      path: verifierHandoffPath,
      specId,
    }),
  ).toMatchObject({ specId });
  expect(
    await readSimplifierHandoff({
      path: join(specPath, 'handoffs', 'simplifier', 'S.json'),
      specId,
      projectRoot: repository.path,
    }),
  ).toMatchObject({
    specId,
    refactoredFiles: [],
    summary: 'No simplification needed.',
    notes: [],
  });
  expect(await readFile(proposalFilePath, 'utf8')).toBe(approvedProposal);
  expect(await readFile(specFilePath, 'utf8')).toBe(approvedSpec);
  expect(await readFile(designFilePath, 'utf8')).toBe(approvedDesign);

  const event = await session.extensionRunner.emitBeforeAgentStart(
    { messageType: 'user', prompt: 'Discuss the next change.' },
    {
      cwd: session.extensionRunner.createContext().cwd,
      sections: { foreign: 'Keep foreign instructions' },
    },
  );

  expect(event.systemPromptOptions.sections.maestro).toContain('You own the final summary.');
  expect(event.systemPromptOptions.sections.maestro).toContain('No final tool call is required.');
});

type PrepareSpecRevisionPhaseInput = {
  paths: MaestroPaths;
  phase: WorkflowState['phase'];
};

const prepareSpecRevisionPhase = async ({
  paths,
  phase,
}: PrepareSpecRevisionPhaseInput): Promise<void> => {
  await prepareBuilderRun({ config: TEST_CONFIG, paths, specId: SPEC_ID });

  if (phase === WORKFLOW_PHASES.ESCALATION_DECISIONS) {
    await completeBuilderPass({
      config: TEST_CONFIG,
      paths,
      specId: SPEC_ID,
      handoff: unavailableCompilerEscalation,
    });

    return;
  }

  // phase === WORKFLOW_PHASES.FINDING_DECISIONS
  await completeBuilderPass({
    config: TEST_CONFIG,
    paths,
    specId: SPEC_ID,
    handoff: doneHandoff(),
  });
  await prepareVerifierRun({ config: TEST_CONFIG, paths, specId: SPEC_ID });
  await completeVerifierPass({
    config: TEST_CONFIG,
    paths,
    specId: SPEC_ID,
    handoff: {
      version: VERIFIER_HANDOFF_VERSION,
      specId: SPEC_ID,
      summary: 'The compiler is unavailable.',
      acceptanceCriteria: doneHandoff().acceptanceCriteria,
      findings: [
        {
          id: 'F1',
          acceptanceCriterion: null,
          severity: FINDING_SEVERITIES.MEDIUM,
          confidence: 1,
          summary: 'The required compiler cannot run in this environment.',
          evidence: [
            {
              source: 'Compiler check',
              observation: 'The compiler is unavailable.',
            },
          ],
          decision: null,
        },
      ],
      notes: [],
    },
  });
};

it.each([WORKFLOW_PHASES.ESCALATION_DECISIONS, WORKFLOW_PHASES.FINDING_DECISIONS])(
  'GIVEN a workflow in %s WHEN the owner records a decision to revise the spec and approves the revision THEN the same workflow returns to ready-for-builder',
  async (phase) => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const { paths, repository } = await createApprovedWorkflow();

    const current = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));

    await prepareSpecRevisionPhase({ paths, phase });

    const { session, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    chooseNewSpec(session);
    await session.prompt('/maestro');
    const theme = session.extensionRunner.createContext().ui.theme;
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const resolveTool = session.agent.state.tools.find(
      (tool) =>
        tool.name ===
        (phase === WORKFLOW_PHASES.ESCALATION_DECISIONS
          ? RESOLVE_ESCALATIONS_TOOL.NAME
          : RESOLVE_FINDINGS_TOOL.NAME),
    );

    assertToolRegistered(resolveTool);

    const resolution = await resolveTool.execute(
      'revision-decision',
      phase === WORKFLOW_PHASES.ESCALATION_DECISIONS
        ? {
            specId: SPEC_ID,
            specChangeRequired: true,
            decisions: [
              {
                escalationId: 'E1',
                selectedOptionId: null,
                decision:
                  'Revise the spec to use a local check instead of the unavailable compiler',
                reason: 'The required compiler cannot run in this environment',
              },
            ],
          }
        : {
            specId: SPEC_ID,
            decisions: [
              {
                findingId: 'F1',
                decision: FINDING_DECISIONS.REVISE_SPEC,
                reason: 'The required compiler cannot run in this environment',
                specChange: 'Use a local check instead of the unavailable compiler',
              },
            ],
          },
    );

    expect(resolution.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });
    await expect(readWorkflowState(paths.getWorkflowPath(SPEC_ID))).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });

    await writeFile(
      paths.getSpecFilePath(SPEC_ID),
      '# Owner-approved revised contract\nUse a local check instead of the unavailable compiler.\n',
      'utf8',
    );

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

    expect(result.details).toEqual({
      ...current,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    await expect(readWorkflowState(paths.getWorkflowPath(SPEC_ID))).resolves.toEqual(
      result.details,
    );
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', `Maestro active · ${SPEC_ID.slice(0, 26)}... · `) +
        '🚧 ' +
        theme.fg('accent', 'Ready for builder'),
    );
  },
);

it('GIVEN the builder reports an unavailable compiler WHEN its run finishes THEN Maestro returns the escalation and shows that an owner decision is needed', async () => {
  const { paths, repository } = await createApprovedWorkflow();

  const { session, setStatus } = await piTestSessions.create({
    extensions: [foreignExtension, maestroExtension],
    cwd: repository.path,
  });

  chooseNewSpec(session);
  await session.prompt('/maestro');
  const theme = session.extensionRunner.createContext().ui.theme;
  maestroSessionState.setActiveSpecId(SPEC_ID);
  const requests: ExecuteTaskInput[] = [];
  vi.mocked(executeTask).mockImplementation(async (request) => {
    requests.push(request);

    await completeBuilderPass({
      config: TEST_CONFIG,
      paths,
      specId: SPEC_ID,
      handoff: unavailableCompilerEscalation,
    });

    return { text: 'The scripted child work finished.' };
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
    roleGuidance: expect.stringContaining('# Builder'),
  });
  expect(result.details).toMatchObject({
    outcome: BUILDER_HANDOFF_STATUSES.ESCALATION,
    phase: WORKFLOW_PHASES.ESCALATION_DECISIONS,
    handoff: {
      ...unavailableCompilerEscalation,
      version: '1.0.0',
      specId: SPEC_ID,
    },
  });
  expect(result.content).toEqual([
    {
      type: 'text',
      text: expect.stringContaining('waiting for an owner decision'),
    },
  ]);
  expect(setStatus).toHaveBeenLastCalledWith(
    MAESTRO_STATUS_KEY,
    theme.fg('muted', `Maestro active · ${SPEC_ID.slice(0, 26)}... · `) +
      '✋ ' +
      theme.fg('warning', 'Owner decision needed: escalations'),
  );
});

it('GIVEN the active spec has no workflow file WHEN Maestro prepares the next prompt THEN it reports the missing file, clears its status, and still adds its instructions', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);

  const { session, notify, setStatus } = await piTestSessions.create({
    extensions: [foreignExtension, maestroExtension],
    cwd: repository.path,
  });

  await saveConfiguration({
    cwd: repository.path,
    agentModelSelections: {
      builder: TEST_CONFIG.builder,
      verifier: TEST_CONFIG.verifier,
      simplifier: TEST_CONFIG.simplifier,
    },
  });
  chooseNewSpec(session);
  await session.prompt('/maestro');
  maestroSessionState.setActiveSpecId(SPEC_ID);

  const event = await session.extensionRunner.emitBeforeAgentStart(
    { messageType: 'user', prompt: 'Discuss the next change.' },
    {
      cwd: session.extensionRunner.createContext().cwd,
      sections: { foreign: 'Keep foreign instructions' },
    },
  );

  expect(event.systemPromptOptions.sections.maestro).toContain('You are Maestro');
  expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
  expect(notify).toHaveBeenCalledWith(expect.stringContaining('ENOENT'), 'error');
});
