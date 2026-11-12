/**
 * Objective: Check verifier delegation, saved results, and execution errors.
 * Used: In integration tests for the registered verifier run tool.
 */

import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AgentToolUpdateCallback } from '@earendil-works/pi-coding-agent';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BUILDER_HANDOFF_STATUSES, PROBE_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
} from '#artifacts/verifier-handoff/schema.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { executeTask } from '#src/delegation/executeTask.ts';
import { TaskExecutionError } from '#src/delegation/TaskExecutionError.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import {
  recordVerifierHandoffTool,
  VERIFIER_HANDOFF_TOOL,
} from '#tools/child/record-verifier-handoff.ts';
import { registerRunVerifierTool } from '#tools/main/run-verifier.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';

const createReadyForVerifierWorkflow = async (simplifierRequired: boolean = true) => {
  const workflow = await createApprovedWorkflow({
    agents: {
      verifier: { model: 'openai-codex/gpt-6-astra', thinking: 'medium' },
      simplifier: { required: simplifierRequired },
    },
  });

  await prepareBuilderRun({ config: TEST_CONFIG, paths: workflow.paths, specId: SPEC_ID });

  await completeBuilderPass({
    config: TEST_CONFIG,
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: {
      status: BUILDER_HANDOFF_STATUSES.DONE,
      escalations: [],
      summary: 'The approved change was implemented.',
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

  return workflow;
};

type RecordVerifierHandoffInput = {
  paths: MaestroPaths;
  findings?: readonly unknown[];
};

const recordVerifierHandoff = async ({
  paths,
  findings = [],
}: RecordVerifierHandoffInput): Promise<void> => {
  await completeVerifierPass({
    config: await loadConfiguration(paths.getProjectRoot()),
    paths,
    specId: SPEC_ID,
    handoff: {
      version: VERIFIER_HANDOFF_VERSION,
      specId: SPEC_ID,
      summary: 'The candidate was independently verified.',
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
};

vi.mock('#src/delegation/executeTask.ts', () => ({ executeTask: vi.fn<typeof executeTask>() }));

afterEach(async () => {
  vi.mocked(executeTask).mockReset();
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('run verifier tool', () => {
  it('given verifier run inputs when the tool schema is checked then a spec ID is required and extra fields are rejected', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerRunVerifierTool,
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

  it('given a ready-for-verifier workflow when verification finishes without findings then the verifier uses the configured SDK inputs and project, saves its report, and requests simplification', async () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const workflow = await createReadyForVerifierWorkflow();

    const { tool, notify } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    const sessionFile = join(workflow.repository.path, 'child.jsonl');
    await writeFile(sessionFile, '{}\n');
    const controller = new AbortController();
    vi.mocked(executeTask).mockImplementationOnce(async () => {
      await recordVerifierHandoff({
        paths: workflow.paths,
      });

      return { text: 'Completed successfully', sessionFile };
    });

    const onUpdate = vi.fn<AgentToolUpdateCallback>();

    const result = await tool.execute(
      'test-call',
      { specId: SPEC_ID },
      controller.signal,
      onUpdate,
    );

    expect(onUpdate).toHaveBeenCalledWith({
      content: [{ type: 'text', text: 'Elapsed: 0m 0s' }],
      details: undefined,
    });

    const receivedRequest = vi.mocked(executeTask).mock.calls[0][0];
    expect(receivedRequest).toMatchObject({
      cwd: workflow.repository.path,
      model: 'openai-codex/gpt-6-astra',
      thinkingLevel: 'medium',
      prompt: expect.stringContaining(SPEC_ID),
    });
    expect(receivedRequest).toMatchObject({
      prompt: expect.stringContaining(workflow.repository.path),
    });

    expect(result.details).toMatchObject({
      outcome: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(
          'Call maestro_run_simplifier next with this specId, without another approval or verifier pass.',
        ),
      },
    ]);

    await expect(access(workflow.paths.getVerifierHandoffsPath(SPEC_ID))).resolves.toBeUndefined();
    await expect(
      access(
        workflow.paths.getVerifierHandoffPath({
          specId: SPEC_ID,
          handoffPassNumber: 1,
        }),
      ),
    ).resolves.toBeUndefined();
    const input = vi.mocked(executeTask).mock.calls[0][0];
    expect(input.signal).toBe(controller.signal);
    expect(input.roleGuidance).toBe(
      await readFile(new URL('../../../agents/verifier.md', import.meta.url), 'utf8'),
    );
    expect(input.additionalTools.map((tool) => tool.name)).toEqual([VERIFIER_HANDOFF_TOOL.NAME]);
    expect(notify).toHaveBeenCalledWith(`Saved child session: ${sessionFile}`, 'info');
  });

  it('given the verifier saves a report with findings when its run finishes then the tool returns those findings in finding-decisions', async () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const workflow = await createReadyForVerifierWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    vi.mocked(executeTask).mockImplementationOnce(async () => {
      await recordVerifierHandoff({
        paths: workflow.paths,
        findings: [
          {
            id: 'F1',
            acceptanceCriterion: null,
            severity: FINDING_SEVERITIES.MEDIUM,
            confidence: 1,
            summary: 'The verifier found a problem.',
            evidence: [{ source: 'test', observation: 'The problem was observed.' }],
            decision: null,
          },
        ],
      });

      return { text: 'Completed successfully' };
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    expect(result.details).toMatchObject({
      outcome: WORKFLOW_PHASES.FINDING_DECISIONS,
      phase: WORKFLOW_PHASES.FINDING_DECISIONS,
      handoff: { findings: [{ id: 'F1' }] },
    });
  });

  it('given a workflow in ready-for-builder when a verifier run is requested then it fails before SDK execution', async () => {
    const workflow = await createApprovedWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    await expect(tool.execute('test-call', { specId: SPEC_ID })).rejects.toThrow(
      'Verifier run requires ready-for-verifier state, found "ready-for-builder".',
    );
    expect(executeTask).not.toHaveBeenCalled();
  });

  it('given the verifier reports completion without saving its report when the run tool receives the response then a protocol error is raised', async () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const workflow = await createReadyForVerifierWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    vi.mocked(executeTask).mockImplementationOnce(async () => {
      return { text: 'Completed successfully' };
    });

    await expect(tool.execute('test-call', { specId: SPEC_ID })).rejects.toThrow(
      'Verifier protocol error: The verifier returned without recording a valid terminal handoff.',
    );

    await expect(
      access(
        workflow.paths.getVerifierHandoffPath({
          specId: SPEC_ID,
          handoffPassNumber: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

it('given simplifier disabled when verification completes without findings then candidate-ready is saved without simplifier delegation', async () => {
  maestroSessionState.activate();
  maestroSessionState.setActiveSpecId(SPEC_ID);

  const workflow = await createReadyForVerifierWorkflow(false);

  const { tool } = await piTestSessions.createRegisteredTool({
    cwd: workflow.repository.path,
    extension: registerRunVerifierTool,
  });

  const { tool: childTool } = await piTestSessions.createRegisteredTool({
    cwd: workflow.repository.path,
    extension: (pi) => {
      pi.registerTool(recordVerifierHandoffTool);
    },
  });

  vi.mocked(executeTask).mockImplementationOnce(async () => {
    await childTool.execute('record-verifier', {
      specId: SPEC_ID,
      summary: 'Verified weather alerts',
      acceptanceCriteria: [
        { id: 'AC1', probe: 'Acceptance check', probeStatus: PROBE_STATUSES.PASSED },
      ],
      findings: [],
      notes: [],
    });

    return { text: 'Completed successfully' };
  });
  const result = await tool.execute('verifier-without-simplifier', { specId: SPEC_ID });
  expect(result.details).toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
  await expect(readWorkflowState(workflow.paths.getWorkflowPath(SPEC_ID))).resolves.toMatchObject({
    phase: WORKFLOW_PHASES.CANDIDATE_READY,
  });
  expect(executeTask).toHaveBeenCalledOnce();
  expect(result.content).toEqual([
    { type: 'text', text: expect.stringContaining('Simplifier skipped by configuration') },
  ]);
});

it.each([
  { failure: 'model error', message: 'Provider unavailable', interrupted: false },
  { failure: 'interruption', message: 'Child interrupted', interrupted: true },
  { failure: 'missing handoff', message: 'Verifier protocol error', interrupted: false },
])(
  'given a verifier $failure with a saved session when execution stops then the path is displayed and the workflow stays verifier-running without a handoff',
  async ({ failure, message, interrupted }) => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const { paths, repository } = await createReadyForVerifierWorkflow();

    const { tool, notify } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRunVerifierTool,
    });

    const sessionFile = join(repository.path, 'child.jsonl');
    await writeFile(sessionFile, '{}\n');
    const cause = new Error(message);

    if (interrupted) cause.name = 'AbortError';
    vi.mocked(executeTask).mockImplementationOnce(async () => {
      if (failure === 'missing handoff') return { text: 'Completed successfully', sessionFile };
      throw new TaskExecutionError({ cause, sessionFile });
    });
    await expect(tool.execute('failed-run', { specId: SPEC_ID })).rejects.toThrow(message);
    expect(notify).toHaveBeenCalledExactlyOnceWith(`Saved child session: ${sessionFile}`, 'info');
    expect(executeTask).toHaveBeenCalledOnce();
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });
    await expect(
      access(paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 })),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

it('given a verifier execution error without a saved session when execution stops then no session path is displayed', async () => {
  maestroSessionState.activate();
  maestroSessionState.setActiveSpecId(SPEC_ID);

  const { repository } = await createReadyForVerifierWorkflow();

  const { tool, notify } = await piTestSessions.createRegisteredTool({
    cwd: repository.path,
    extension: registerRunVerifierTool,
  });

  vi.mocked(executeTask).mockRejectedValueOnce(
    new TaskExecutionError({ cause: new Error('Failed before saving') }),
  );
  await expect(tool.execute('failed-run', { specId: SPEC_ID })).rejects.toThrow(
    'Failed before saving',
  );
  expect(notify).not.toHaveBeenCalled();
});
