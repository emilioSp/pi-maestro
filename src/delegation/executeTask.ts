/**
 * Objective: Execute one independent task and own its complete native Pi session lifecycle.
 * Used: By internal callers that await child executions sequentially, outside workflow routing.
 */

import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type AgentSession,
  type AgentSessionEvent,
  createAgentSession,
  type CreateAgentSessionOptions,
  SessionManager,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';

import { prepareSubagentEnvironment } from '#src/delegation/prepareSubagentEnvironment.ts';
import { readTaskResult } from '#src/delegation/readTaskResult.ts';
import { TaskExecutionError } from '#src/delegation/TaskExecutionError.ts';

export type ExecuteTaskInput = {
  prompt: string;
  roleGuidance: string;
  cwd: string;
  model: string;
  thinkingLevel: NonNullable<CreateAgentSessionOptions['thinkingLevel']>;
  additionalTools: ToolDefinition[];
  signal?: AbortSignal;
  onEvent?: (event: AgentSessionEvent) => void;
};

export type TaskExecutionResult = {
  text: string;
  sessionFile?: string;
};

const getSavedFile = (sessionManager?: SessionManager): string | undefined => {
  const path = sessionManager?.getSessionFile();

  return path && existsSync(path) ? path : undefined;
};

type CloseSessionInput = {
  session?: AgentSession;
  abortPromise?: Promise<void>;
};

const closeSession = async ({ session, abortPromise }: CloseSessionInput): Promise<void> => {
  if (!session) return;

  try {
    await session.abort();
    await abortPromise;
  } finally {
    try {
      // AgentSession.dispose() does not emit shutdown. Extensions such as MCP need it
      // to release their connections before the session is disposed.
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
    } finally {
      session.dispose();
    }
  }
};

export const executeTask = async ({
  prompt,
  roleGuidance,
  cwd: workingDirectory,
  model: modelId,
  thinkingLevel,
  additionalTools,
  signal,
  onEvent,
}: ExecuteTaskInput): Promise<TaskExecutionResult> => {
  let session: AgentSession | undefined;
  let sessionManager: SessionManager | undefined;
  let abortPromise: Promise<void> | undefined;
  let unsubscribe: (() => void) | undefined;

  const abort = (): void => {
    abortPromise = session?.abort();
    // Cleanup awaits this promise. Handle rejection immediately as well.
    void abortPromise?.catch(() => {});
  };

  try {
    try {
      const cwd = await realpath(workingDirectory);
      const services = await prepareSubagentEnvironment({ cwd, roleGuidance, additionalTools });

      const model = (await services.modelRuntime.getAvailable()).find(
        (entry) => `${entry.provider}/${entry.id}` === modelId,
      );

      if (!model) throw new Error(`Model is not available: "${modelId}".`);

      sessionManager = SessionManager.create(
        cwd,
        join(SessionManager.create(cwd).getSessionDir(), 'subagents'),
      );

      ({ session } = await createAgentSession({
        ...services,
        sessionManager,
        model,
        thinkingLevel,
      }));

      if (onEvent) unsubscribe = session.subscribe(onEvent);
      signal?.addEventListener('abort', abort, { once: true });

      await session.bindExtensions({ mode: 'print' });
      await session.prompt(prompt, { expandPromptTemplates: false });

      const text = readTaskResult(
        session.messages.findLast((message) => message.role === 'assistant'),
      );

      return { text, sessionFile: getSavedFile(sessionManager) };
    } finally {
      unsubscribe?.();
      signal?.removeEventListener('abort', abort);
      await closeSession({ session, abortPromise });
    }
  } catch (cause) {
    throw new TaskExecutionError({ cause, sessionFile: getSavedFile(sessionManager) });
  }
};
