/**
 * Objective: Validate the read-only environment required by Maestro.
 * Used: When the owner activates Maestro mode.
 */

import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { resolveSubagentLaunchContract } from 'pi-subagents/preflight';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { AGENTS } from '#config/schema.ts';

export const SUBAGENT_PING = {
  REQUEST_EVENT: 'subagents:rpc:v1:request',
  REPLY_EVENT_PREFIX: 'subagents:rpc:v1:reply:',
  VERSION: 1,
  METHOD: 'ping',
  TIMEOUT_MS: 2000,
  INSTALLATION_ERROR:
    'Maestro flow requires pi-subagents installed in the Pi environment.',
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
    throw new Error(
      `Maestro configuration check failed: ${getErrorMessage(error)}`,
    );
  }
};

type AssertModelsAvailableInput = {
  context: ExtensionContext;
  config: Awaited<ReturnType<typeof loadConfiguration>>;
};

function assertModelsAvailable({
  context,
  config,
}: AssertModelsAvailableInput): void {
  const availableModels = context.modelRegistry.getAvailable();

  for (const model of [config.builder.model, config.verifier.model]) {
    const [provider, id] = model.split('/');

    if (
      !availableModels.some(
        (entry) => entry.provider === provider && entry.id === id,
      )
    ) {
      throw new Error(`Configured model is not available: "${model}".`);
    }
  }
}

async function assertAgentsAvailable(projectRoot: string): Promise<void> {
  for (const agent of [AGENTS.BUILDER, AGENTS.VERIFIER]) {
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

type SuccessfulPingReply = {
  version: typeof SUBAGENT_PING.VERSION;
  requestId: string;
  method: typeof SUBAGENT_PING.METHOD;
  success: true;
  data: { version: typeof SUBAGENT_PING.VERSION };
};

function assertSuccessfulPingReply(
  reply: unknown,
): asserts reply is SuccessfulPingReply {
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

async function assertSubagentsRespond(
  piEventsBus: ExtensionAPI['events'],
): Promise<void> {
  const requestId = randomUUID();
  const { promise, resolve, reject } = Promise.withResolvers<unknown>();

  const unsubscribe = piEventsBus.on(
    `${SUBAGENT_PING.REPLY_EVENT_PREFIX}${requestId}`,
    (reply) => {
      if (isReplyWithRequestId(reply) && reply.requestId !== requestId) {
        return;
      }

      resolve(reply);
    },
  );

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

  try {
    await assertAgentsAvailable(projectRoot);
  } catch (error) {
    throw new Error(
      `Builder or verifier agent check failed: ${getErrorMessage(error)}`,
    );
  }

  const config = await getActivationConfiguration(projectRoot);

  assertModelsAvailable({ context, config });

  try {
    await assertSubagentsRespond(piEventsBus);
  } catch (error) {
    throw new Error(
      `${SUBAGENT_PING.INSTALLATION_ERROR} ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
}
