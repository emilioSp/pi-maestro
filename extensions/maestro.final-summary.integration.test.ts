/**
 * Objective: Verify when delivery of the final summary turns Maestro off.
 * Used: In integration tests with real offline Pi sessions.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { type AssistantMessage, createAssistantMessageEventStream } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { afterEach, expect, it, vi } from 'vitest';

import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import maestroExtension from '#extensions/maestro.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MAESTRO_STATUS_KEY } from '#maestro/status/refreshMaestroStatus.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { createApprovedWorkflow, doneHandoff, SPEC_ID } from '#tests/support/builder-workflow.ts';
import {
  FOREIGN_TOOL,
  MAIN_TOOL_NAMES,
  assertToolRegistered,
  chooseNewSpec,
  foreignExtension,
} from '#tests/support/maestro-extension.ts';
import * as piTestSessions from '#tests/support/pi-session.ts';
import { SCORE_WORKFLOW_TOOL } from '#tools/main/score-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

afterEach(() => {
  maestroSessionState.deactivate();
});

type StartFinalSummaryInput = {
  completionEvent?:
    | typeof WORKFLOW_EVENTS.SIMPLIFIER_DONE
    | typeof WORKFLOW_EVENTS.SIMPLIFIER_SKIPPED;
  stopReason: 'stop' | 'error' | 'aborted' | 'length';
};

const startFinalSummary = async ({
  completionEvent = WORKFLOW_EVENTS.SIMPLIFIER_DONE,
  stopReason,
}: StartFinalSummaryInput) => {
  maestroSessionState.activate();
  maestroSessionState.setActiveSpecId(SPEC_ID);

  const { paths, repository } = await createApprovedWorkflow();
  await prepareBuilderRun({ config: TEST_CONFIG, paths, specId: SPEC_ID });
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
      summary: 'Verified weather alerts',
      acceptanceCriteria: doneHandoff().acceptanceCriteria,
      findings: [],
      notes: [],
    },
  });

  await writeWorkflowState({
    path: paths.getWorkflowPath(SPEC_ID),
    state: transitionWorkflow({
      config: TEST_CONFIG,
      state: await readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
      event: completionEvent,
    }),
  });

  const extension = (pi: ExtensionAPI): void => {
    maestroExtension(pi);
    pi.on('before_agent_start', (event) => {
      event.systemPromptOptions.sections.foreign = 'Keep foreign instructions';
    });
  };

  const { session, setStatus } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [foreignExtension, extension],
  });

  chooseNewSpec(session);
  await session.prompt('/maestro');
  maestroSessionState.setActiveSpecId(SPEC_ID);
  session.setActiveToolsByName(['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
  const approvedSpec = await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8');

  const verified = await readFile(
    paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }),
    'utf8',
  );

  const scoreTool = session.agent.state.tools.find(
    (tool) => tool.name === SCORE_WORKFLOW_TOOL.NAME,
  );

  assertToolRegistered(scoreTool);
  const scored = await scoreTool.execute('score', { specId: SPEC_ID });
  await session.extensionRunner.emitToolResult({
    type: 'tool_result',
    toolName: SCORE_WORKFLOW_TOOL.NAME,
    toolCallId: 'score',
    input: { specId: SPEC_ID },
    ...scored,
    isError: false,
  });

  const summaryStarted = Promise.withResolvers<void>();
  session.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      summaryStarted.resolve();
    }
  });
  const summaryStream = createAssistantMessageEventStream();

  const finalMessage: AssistantMessage = {
    role: 'assistant',
    api: 'openai-completions',
    provider: 'openai-codex',
    model: 'gpt-6.1-sol',
    content: [
      {
        type: 'text',
        text: `Verification: weather alerts passed. Simplifier: Finished. Evaluation failed: Git HEAD baseline unavailable. No score. Report: ${join(paths.getSpecPath(SPEC_ID), 'evaluation.json')}`,
      },
    ],
    stopReason,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    timestamp: 0,
  };

  vi.spyOn(session.agent, 'streamFunction').mockImplementationOnce(() => {
    summaryStream.push({ type: 'start', partial: finalMessage });
    summaryStream.push({ type: 'text_start', contentIndex: 0, partial: finalMessage });
    summaryStream.push({
      type: 'text_delta',
      contentIndex: 0,
      delta: 'Verification: weather alerts passed.',
      partial: finalMessage,
    });

    return summaryStream;
  });

  const response = session.prompt('Report the final summary.');
  await summaryStarted.promise;
  const savedWorkflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

  return {
    session,
    setStatus,
    paths,
    repository,
    approvedSpec,
    verified,
    savedWorkflow,
    response,
    summaryStream,
    finalMessage,
  };
};

type StartedSummary = Awaited<ReturnType<typeof startFinalSummary>>;

const expectSummaryInProgress = async ({ session, paths }: StartedSummary) => {
  expect(maestroSessionState.isActive()).toBe(true);
  expect(maestroSessionState.getActiveSpecId()).toBe(SPEC_ID);
  expect(session.getActiveToolNames()).toEqual(['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
  expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
    phase: WORKFLOW_PHASES.CANDIDATE_READY,
  });
};

type ExpectSummaryOutcomeInput = {
  summary: StartedSummary;
  maestroIsActive: boolean;
};

const expectSummaryOutcome = async ({
  summary: { session, setStatus, paths, repository, approvedSpec, verified, savedWorkflow },
  maestroIsActive,
}: ExpectSummaryOutcomeInput) => {
  expect(maestroSessionState.getActiveSpecId()).toBe(maestroIsActive ? SPEC_ID : null);
  expect(session.getActiveToolNames()).toEqual(
    maestroIsActive ? ['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES] : ['read', FOREIGN_TOOL],
  );
  expect(setStatus.mock.calls.at(-1)?.[0]).toBe(MAESTRO_STATUS_KEY);
  expect(setStatus.mock.calls.at(-1)?.[1] !== undefined).toBe(maestroIsActive);

  const nextPrompt = await session.extensionRunner.emitBeforeAgentStart(
    { messageType: 'user', prompt: 'Discuss something else.' },
    {
      cwd: repository.path,
      sections: { maestro: 'Stale instructions', foreign: 'Keep foreign instructions' },
    },
  );

  expect(nextPrompt.systemPromptOptions.sections.foreign).toBe('Keep foreign instructions');
  expect(nextPrompt.systemPromptOptions.sections.maestro !== undefined).toBe(maestroIsActive);
  expect(Object.keys(nextPrompt.systemPromptOptions.sections)).toEqual(
    maestroIsActive ? ['maestro', 'foreign'] : ['foreign', 'maestro_status'],
  );

  expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(savedWorkflow);
  expect(await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8')).toBe(approvedSpec);
  expect(
    await readFile(paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }), 'utf8'),
  ).toBe(verified);
};

it.each([
  { simplification: 'completed', completionEvent: WORKFLOW_EVENTS.SIMPLIFIER_DONE },
  { simplification: 'skipped', completionEvent: WORKFLOW_EVENTS.SIMPLIFIER_SKIPPED },
])(
  'GIVEN $simplification simplification WHEN the final summary is delivered THEN Maestro exits after streaming finishes',
  async ({ completionEvent }) => {
    const summary = await startFinalSummary({ completionEvent, stopReason: 'stop' });
    await expectSummaryInProgress(summary);

    summary.summaryStream.push({ type: 'done', reason: 'stop', message: summary.finalMessage });
    await summary.response;

    expect(maestroSessionState.isActive()).toBe(false);
    await expectSummaryOutcome({ summary, maestroIsActive: false });
  },
);

it('GIVEN the final summary is streaming WHEN the provider reports an error THEN Maestro stays active', async () => {
  const summary = await startFinalSummary({ stopReason: 'error' });
  await expectSummaryInProgress(summary);

  summary.summaryStream.push({ type: 'error', reason: 'error', error: summary.finalMessage });
  await summary.response;

  expect(maestroSessionState.isActive()).toBe(true);
  await expectSummaryOutcome({ summary, maestroIsActive: true });
});

it('GIVEN the final summary is streaming WHEN the owner cancels THEN Maestro stays active', async () => {
  const summary = await startFinalSummary({ stopReason: 'aborted' });
  await expectSummaryInProgress(summary);

  const cancellation = summary.session.abort();
  summary.summaryStream.push({ type: 'error', reason: 'aborted', error: summary.finalMessage });
  await cancellation;
  await summary.response;

  expect(maestroSessionState.isActive()).toBe(true);
  await expectSummaryOutcome({ summary, maestroIsActive: true });
});

it('GIVEN the final summary is streaming WHEN the response is truncated THEN Maestro stays active', async () => {
  const summary = await startFinalSummary({ stopReason: 'length' });
  await expectSummaryInProgress(summary);

  summary.summaryStream.push({ type: 'done', reason: 'length', message: summary.finalMessage });
  await summary.response;

  expect(maestroSessionState.isActive()).toBe(true);
  await expectSummaryOutcome({ summary, maestroIsActive: true });
});
