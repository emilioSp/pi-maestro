/**
 * Objective: Own the native session, cancellation, and cleanup for one child execution.
 * Used: By the task executor while opening and closing a fresh SDK conversation.
 */

import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type AgentSession,
  createAgentSession,
  type CreateAgentSessionOptions,
  SessionManager,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';

import { createChildServices } from '#src/delegation/createChildServices.ts';

export type SubSessionManagerInput = {
  roleGuidance: string;
  cwd: string;
  model: string;
  thinkingLevel: NonNullable<CreateAgentSessionOptions['thinkingLevel']>;
  additionalTools: ToolDefinition[];
  signal?: AbortSignal;
};

export class SubSessionManager {
  private session?: AgentSession;
  private sessionManager?: SessionManager;
  private abortPromise?: Promise<void>;

  private readonly input: SubSessionManagerInput;

  constructor(input: SubSessionManagerInput) {
    this.input = input;
  }

  public getSavedFile = (): string | undefined => {
    const path = this.sessionManager?.getSessionFile();

    return path && existsSync(path) ? path : undefined;
  };

  private abort = (): void => {
    this.abortPromise = this.session?.abort();
    // The cleanup path awaits this promise. Handle rejection immediately as well.
    void this.abortPromise?.catch(() => {});
  };

  public open = async (): Promise<AgentSession> => {
    const cwd = await realpath(this.input.cwd);
    const services = await createChildServices({ cwd, roleGuidance: this.input.roleGuidance });

    const model = (await services.modelRuntime.getAvailable()).find(
      (entry) => `${entry.provider}/${entry.id}` === this.input.model,
    );

    if (!model) throw new Error(`Model is not available: "${this.input.model}".`);

    this.sessionManager = SessionManager.create(
      cwd,
      join(SessionManager.create(cwd).getSessionDir(), 'subagents'),
    );

    const { session } = await createAgentSession({
      ...services,
      sessionManager: this.sessionManager,
      model,
      thinkingLevel: this.input.thinkingLevel,
      customTools: this.input.additionalTools, // here child tool registration happens through SDK
    });

    this.session = session;

    this.input.signal?.addEventListener('abort', this.abort, { once: true });

    await this.session.bindExtensions({ mode: 'print' });

    return this.session;
  };

  public close = async (): Promise<void> => {
    this.input.signal?.removeEventListener('abort', this.abort);

    if (!this.session) return;

    try {
      await this.session.abort();
      await this.abortPromise;
    } finally {
      try {
        // AgentSession.dispose() does not emit shutdown. This is the native runtime's
        // shutdown sequence, including extensions such as MCP that own connections.
        await this.session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      } finally {
        this.session.dispose();
      }
    }
  };
}
