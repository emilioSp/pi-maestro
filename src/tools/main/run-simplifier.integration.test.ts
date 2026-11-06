/**
 * Objective: Prove simplifier delegation, Git skips, and result boundaries.
 * Used: With real Pi tools and scripted SDK executions, without model calls.
 */

import { execFile } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { AgentToolUpdateCallback } from '@earendil-works/pi-coding-agent';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { MAESTRO_STATUS_KEY } from '#maestro/status/refreshMaestroStatus.ts';
import { executeTask } from '#src/delegation/executeTask.ts';
import { TaskExecutionError } from '#src/delegation/TaskExecutionError.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { SIMPLIFIER_HANDOFF_TOOL } from '#tools/child/record-simplifier-handoff.ts';
import { registerRunSimplifierTool } from '#tools/main/run-simplifier.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { completeSimplifierPass } from '#workflow/simplifier/completeSimplifierPass.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

const execFileAsync = promisify(execFile);

const createSimplifierWorkflow = async () => {
  const workflow = await createApprovedWorkflow();
  await prepareBuilderRun({ config: DEFAULT_CONFIG, paths: workflow.paths, specId: SPEC_ID });
  await completeBuilderPass({
    config: DEFAULT_CONFIG,
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: doneHandoff(),
  });
  await prepareVerifierRun({ config: DEFAULT_CONFIG, paths: workflow.paths, specId: SPEC_ID });
  await completeVerifierPass({
    config: DEFAULT_CONFIG,
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: {
      version: '1.0.0',
      specId: SPEC_ID,
      summary: 'Verified',
      acceptanceCriteria: doneHandoff().acceptanceCriteria,
      findings: [],
      notes: [],
    },
  });

  return workflow;
};

vi.mock('#src/delegation/executeTask.ts', () => ({ executeTask: vi.fn<typeof executeTask>() }));

afterEach(async () => {
  vi.mocked(executeTask).mockReset();
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('run simplifier', () => {
  it('given Git reports no repository when simplification is requested then Maestro warns, skips the agent, saves candidate-ready, and creates no simplifier report', async () => {
    const { paths, repository } = await createSimplifierWorkflow();
    // The entry route succeeds in a project with no Git repository.
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
      phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
    });

    const extension = (pi: ExtensionAPI): void => {
      vi.spyOn(pi, 'exec').mockResolvedValue({
        code: 0,
        stdout: 'false\n',
        stderr: '',
        killed: false,
        truncated: false,
      });
      registerRunSimplifierTool(pi);
    };

    const { tool, notify } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension,
    });

    expect(Value.Check(tool.parameters, { specId: SPEC_ID })).toBe(true);
    expect(Value.Check(tool.parameters, { specId: SPEC_ID, files: [] })).toBe(false);
    const result = await tool.execute('skip', { specId: SPEC_ID });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Simplifier skipped: Git repository unavailable.',
      },
    ]);
    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      skipped: true,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
    expect(notify).toHaveBeenCalledWith(
      'Simplifier skipped: Git repository unavailable.',
      'warning',
    );
    expect(executeTask).not.toHaveBeenCalled();
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
    await expect(access(paths.getSimplifierHandoffPath(SPEC_ID))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('given a Git project ready for simplification when the simplifier saves its report then one run uses its configured model and project and returns candidate-ready with that report', async () => {
    const { paths, repository } = await createSimplifierWorkflow();
    await execFileAsync('git', ['init', '-q', repository.path]);

    const { tool, notify, session, setStatus } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRunSimplifierTool,
    });

    const sessionFile = join(repository.path, 'child.jsonl');
    await writeFile(sessionFile, '{}\n');
    const controller = new AbortController();
    vi.mocked(executeTask).mockImplementationOnce(async () => {
      expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
        phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
      });
      const theme = session.extensionRunner.createContext().ui.theme;
      expect(setStatus).toHaveBeenLastCalledWith(
        MAESTRO_STATUS_KEY,
        theme.fg('muted', `Maestro active · ${SPEC_ID.slice(0, 26)}... · `) +
          '🧹 ' +
          theme.fg('accent', 'Simplifier running'),
      );
      await completeSimplifierPass({
        config: DEFAULT_CONFIG,
        paths,
        specId: SPEC_ID,
        handoff: {
          version: '1.0.0',
          specId: SPEC_ID,
          refactoredFiles: [],
          summary: 'No simplification needed',
          notes: [],
        },
      });

      return { text: 'Completed successfully', sessionFile };
    });
    const onUpdate = vi.fn<AgentToolUpdateCallback>();
    const result = await tool.execute('simplify', { specId: SPEC_ID }, controller.signal, onUpdate);
    expect(onUpdate).toHaveBeenCalledWith({
      content: [{ type: 'text', text: 'Simplifier | Elapsed: 0m 0s | Active tool: none' }],
      details: undefined,
    });

    const requests = vi.mocked(executeTask).mock.calls;

    expect(requests).toHaveLength(1);
    expect(requests[0][0]).toMatchObject({
      cwd: repository.path,
      model: DEFAULT_CONFIG.simplifier.model,
      thinkingLevel: DEFAULT_CONFIG.simplifier.thinking,
      prompt: expect.stringContaining(SPEC_ID),
    });
    expect(requests[0][0]).toMatchObject({
      prompt: expect.stringContaining(repository.path),
    });
    expect(result.details).toMatchObject({
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      handoff: { refactoredFiles: [], summary: 'No simplification needed' },
    });
    const input = vi.mocked(executeTask).mock.calls[0][0];
    expect(input.signal).toBe(controller.signal);
    expect(input.roleGuidance).toBe(
      await readFile(new URL('../../../agents/simplifier.md', import.meta.url), 'utf8'),
    );
    expect(input.additionalTools.map((tool) => tool.name)).toEqual([SIMPLIFIER_HANDOFF_TOOL.NAME]);
    expect(notify).toHaveBeenCalledWith(`Saved child session: ${sessionFile}`, 'info');
  });

  it('given a workflow in ready-for-builder when simplification is requested then a phase error stops the call before any Git check or agent request', async () => {
    const { repository } = await createApprovedWorkflow();

    const extension = (pi: ExtensionAPI): void => {
      vi.spyOn(pi, 'exec').mockImplementation(() => {
        throw new Error('Git must not run');
      });
      registerRunSimplifierTool(pi);
    };

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension,
    });

    await expect(tool.execute('wrong-phase', { specId: SPEC_ID })).rejects.toThrow(
      'Simplifier run requires simplifier-running',
    );
    expect(executeTask).not.toHaveBeenCalled();
  });
});

it.each([
  { failure: 'model error', message: 'Provider unavailable', interrupted: false },
  { failure: 'interruption', message: 'Child interrupted', interrupted: true },
  { failure: 'missing handoff', message: 'Simplifier protocol error', interrupted: false },
])(
  'given a simplifier $failure with a saved session when execution stops then the path is displayed and the workflow stays simplifier-running without a handoff',
  async ({ failure, message, interrupted }) => {
    const { paths, repository } = await createSimplifierWorkflow();
    await execFileAsync('git', ['init', '-q', repository.path]);

    const { tool, notify } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRunSimplifierTool,
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
      phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
    });
    await expect(access(paths.getSimplifierHandoffPath(SPEC_ID))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  },
);

it('given a simplifier execution error without a saved session when execution stops then no session path is displayed', async () => {
  const { repository } = await createSimplifierWorkflow();
  await execFileAsync('git', ['init', '-q', repository.path]);

  const { tool, notify } = await piTestSessions.createRegisteredTool({
    cwd: repository.path,
    extension: registerRunSimplifierTool,
  });

  vi.mocked(executeTask).mockRejectedValueOnce(
    new TaskExecutionError({ cause: new Error('Failed before saving') }),
  );
  await expect(tool.execute('failed-run', { specId: SPEC_ID })).rejects.toThrow(
    'Failed before saving',
  );
  expect(notify).not.toHaveBeenCalled();
});
