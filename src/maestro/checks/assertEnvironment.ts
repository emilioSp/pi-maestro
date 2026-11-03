/**
 * Objective: Validate the read-only environment required by Maestro.
 * Used: When the owner activates Maestro mode.
 */

import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { resolveSubagentLaunchContract } from 'pi-subagents/preflight';

import { loadConfiguration } from '#config/loadConfiguration.ts';
import { AGENTS } from '#config/schema.ts';

export const SUBAGENT_PING = {
  REQUEST_EVENT: 'subagents:rpc:v1:request',
  REPLY_EVENT_PREFIX: 'subagents:rpc:v1:reply:',
  VERSION: 1,
  METHOD: 'ping',
  TIMEOUT_MS: 2000,
  INSTALLATION_ERROR: 'Maestro flow requires pi-subagents installed in the Pi environment.',
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const getProjectRoot = async (context: ExtensionContext): Promise<string> => {
  try {
    const projectRoot = await realpath(context.cwd);

    if (!context.isProjectTrusted()) {
      throw new Error(`Project is not trusted: "${projectRoot}".`);
    }

    return projectRoot;
  } catch (error) {
    throw new Error(`Project check failed: ${getErrorMessage(error)}`);
  }
};

const getActivationConfiguration = async (
  projectRoot: string,
): Promise<Awaited<ReturnType<typeof loadConfiguration>>> => {
  try {
    return await loadConfiguration(projectRoot);
  } catch (error) {
    throw new Error(`Maestro configuration check failed: ${getErrorMessage(error)}`);
  }
};

type AssertModelsAvailableInput = {
  context: ExtensionContext;
  models: string[];
};

function assertModelsAvailable({ context, models }: AssertModelsAvailableInput): void {
  const availableModels = context.modelRegistry.getAvailable();

  for (const model of models) {
    if (!availableModels.some((entry) => `${entry.provider}/${entry.id}` === model)) {
      throw new Error(`Configured model is not available: "${model}".`);
    }
  }
}

type AssertAgentsAvailableInput = {
  projectRoot: string;
  agents: string[];
};

async function assertAgentsAvailable({
  projectRoot,
  agents,
}: AssertAgentsAvailableInput): Promise<void> {
  for (const agent of agents) {
    const result = await resolveSubagentLaunchContract({
      agent,
      cwd: projectRoot,
      context: 'fresh',
    });

    if (!result.ok) {
      throw new Error(result.message);
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isReplyWithRequestId = (
  reply: unknown,
): reply is Record<string, unknown> & { requestId: string } =>
  isRecord(reply) && typeof reply.requestId === 'string';

function assertSuccessfulPingReply(reply: unknown): void {
  if (
    !isReplyWithRequestId(reply) ||
    reply.version !== SUBAGENT_PING.VERSION ||
    reply.method !== SUBAGENT_PING.METHOD ||
    reply.success !== true ||
    !isRecord(reply.data) ||
    reply.data.version !== SUBAGENT_PING.VERSION
  ) {
    throw new Error('Unsuccessful or invalid pi-subagents ping reply.');
  }
}

async function assertSubagentsRespond(piEventsBus: ExtensionAPI['events']): Promise<void> {
  const requestId = randomUUID();
  const { promise, resolve, reject } = Promise.withResolvers<unknown>();

  const unsubscribe = piEventsBus.on(`${SUBAGENT_PING.REPLY_EVENT_PREFIX}${requestId}`, (reply) => {
    if (isReplyWithRequestId(reply) && reply.requestId !== requestId) {
      return;
    }

    resolve(reply);
  });

  const timeout = setTimeout(
    () => reject(new Error('Pi-subagents ping timed out after 2000 ms.')),
    SUBAGENT_PING.TIMEOUT_MS,
  );

  try {
    piEventsBus.emit(SUBAGENT_PING.REQUEST_EVENT, {
      version: SUBAGENT_PING.VERSION,
      requestId,
      method: SUBAGENT_PING.METHOD,
    });
    assertSuccessfulPingReply(await promise);
  } finally {
    clearTimeout(timeout);
    unsubscribe();
  }
}

type AssertEnvironmentInput = {
  context: ExtensionContext;
  piEventsBus: ExtensionAPI['events'];
};

export async function assertEnvironment({
  context,
  piEventsBus,
}: AssertEnvironmentInput): Promise<void> {
  const projectRoot = await getProjectRoot(context);
  const config = await getActivationConfiguration(projectRoot);

  if (!config.builder.required) return;

  const enabledAgents = [
    { agent: AGENTS.BUILDER, settings: config.builder },
    { agent: AGENTS.VERIFIER, settings: config.verifier },
    { agent: AGENTS.SIMPLIFIER, settings: config.simplifier },
  ].filter(({ settings }) => settings.required);

  try {
    await assertAgentsAvailable({ projectRoot, agents: enabledAgents.map(({ agent }) => agent) });
  } catch (error) {
    throw new Error(
      `Builder, verifier, or simplifier agent check failed: ${getErrorMessage(error)}`,
    );
  }

  assertModelsAvailable({ context, models: enabledAgents.map(({ settings }) => settings.model) });

  try {
    await assertSubagentsRespond(piEventsBus);
  } catch (error) {
    throw new Error(`${SUBAGENT_PING.INSTALLATION_ERROR} ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}
