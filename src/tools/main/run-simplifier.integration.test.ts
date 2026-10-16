/**
 * Objective: Prove simplifier delegation, Git skips, and result boundaries.
 * Used: With real Pi tools and scripted delegation responses, without model calls.
 */

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { AGENTS } from '#config/schema.ts';
import { MAESTRO_STATUS_KEY } from '#maestro/status/refreshMaestroStatus.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { registerRunSimplifierTool } from '#tools/main/run-simplifier.ts';
import { DELEGATION_STATUSES } from '#tools/utils/pi-subagent-delegation.ts';
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
  await prepareBuilderRun({ paths: workflow.paths, specId: SPEC_ID });
  await completeBuilderPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: doneHandoff(),
  });
  await prepareVerifierRun({ paths: workflow.paths, specId: SPEC_ID });
  await completeVerifierPass({
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

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('run simplifier', () => {
  it('given Git is unavailable when simplification runs then a warning concludes without delegation or handoff', async () => {
    const { paths, repository } = await createSimplifierWorkflow();
    // The entry route succeeds in a project with no Git repository.
    expect(
      await readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).toMatchObject({ phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING });

    const extension = (pi: ExtensionAPI): void => {
      vi.spyOn(pi, 'exec').mockResolvedValue({
        code: 0,
        stdout: 'false\n',
        stderr: '',
        killed: false,
      });
      registerRunSimplifierTool(pi);
    };

    const { tool, emit, notify } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension,
    });

    expect(Value.Check(tool.parameters, { specId: SPEC_ID })).toBe(true);
    expect(Value.Check(tool.parameters, { specId: SPEC_ID, files: [] })).toBe(
      false,
    );
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
    expect(emit).not.toHaveBeenCalledWith(
      SUBAGENT_DELEGATION_REQUEST_EVENT,
      expect.anything(),
    );
    expect(
      await readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
    await expect(
      access(paths.getSimplifierHandoffPath(SPEC_ID)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('given a Git project when the simplifier saves its result then one configured fresh foreground request completes the workflow', async () => {
    const { paths, repository } = await createSimplifierWorkflow();
    await execFileAsync('git', ['init', '-q', repository.path]);

    const { tool, events, emit, session, setStatus } =
      await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerRunSimplifierTool,
      });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The registered run tool emits this typed delegation request.
      const request = payload as SubagentDelegationRequest;
      expect(
        await readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
      ).toMatchObject({ phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING });
      const theme = session.extensionRunner.createContext().ui.theme;
      expect(setStatus).toHaveBeenLastCalledWith(
        MAESTRO_STATUS_KEY,
        theme.fg('muted', `Maestro active · ${SPEC_ID.slice(0, 26)}... · `) +
          '🧹 ' +
          theme.fg('accent', 'Simplifier running'),
      );
      await completeSimplifierPass({
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
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'Done' },
      });
    });
    const result = await tool.execute('simplify', { specId: SPEC_ID });

    const requests = emit.mock.calls.filter(
      ([channel]) => channel === SUBAGENT_DELEGATION_REQUEST_EVENT,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0][1]).toMatchObject({
      ownerRunId: 'simplify',
      agent: AGENTS.SIMPLIFIER,
      nodeId: 'simplifier',
      context: 'fresh',
      cwd: repository.path,
      model: DEFAULT_CONFIG.simplifier.model,
      thinking: DEFAULT_CONFIG.simplifier.thinking,
      timeoutMs: 60 * 60_000,
      task: expect.stringContaining(SPEC_ID),
    });
    expect(requests[0][1]).toMatchObject({
      task: expect.stringContaining(repository.path),
    });
    expect(result.details).toMatchObject({
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      handoff: { refactoredFiles: [], summary: 'No simplification needed' },
    });
  });

  it.each([
    DELEGATION_STATUSES.COMPLETED,
    DELEGATION_STATUSES.FAILED,
    DELEGATION_STATUSES.TIMED_OUT,
    DELEGATION_STATUSES.INTERRUPTED,
  ])(
    'given a %s response without a saved handoff when the run returns then the workflow stops with an error',
    async (status) => {
      const { paths, repository } = await createSimplifierWorkflow();
      await execFileAsync('git', ['init', '-q', repository.path]);

      const { tool, events } = await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerRunSimplifierTool,
      });

      events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
        // JUSTIFICATION: The registered run tool emits this typed delegation request.
        const request = payload as SubagentDelegationRequest;
        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          status,
          error: 'Stopped before saving',
          result: { kind: 'text', text: 'No saved result' },
        });
      });
      await expect(
        tool.execute('failure', { specId: SPEC_ID }),
      ).rejects.toThrow(
        status === DELEGATION_STATUSES.COMPLETED
          ? 'Simplifier protocol error'
          : 'Delegation',
      );
      expect(
        await readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
      ).toMatchObject({ phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING });
      await expect(
        access(paths.getSimplifierHandoffPath(SPEC_ID)),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  it('given a ready-for-builder workflow when simplification is requested then validation rejects before checking Git', async () => {
    const { repository } = await createApprovedWorkflow();

    const extension = (pi: ExtensionAPI): void => {
      vi.spyOn(pi, 'exec').mockImplementation(() => {
        throw new Error('Git must not run');
      });
      registerRunSimplifierTool(pi);
    };

    const { tool, emit } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension,
    });

    await expect(
      tool.execute('wrong-phase', { specId: SPEC_ID }),
    ).rejects.toThrow('Simplifier run requires simplifier-running');
    expect(emit).not.toHaveBeenCalled();
  });
});
