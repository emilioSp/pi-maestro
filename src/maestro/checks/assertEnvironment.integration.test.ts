/**
 * Objective: Check Maestro's read-only activation requirements.
 * Used: In integration tests with isolated Pi environments and controlled ping replies.
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CONFIG_DIRECTORY_NAME,
  CONFIG_FILE_PATH,
  DEFAULT_CONFIG_VERSION,
  DEFAULT_SPEC_DIRECTORY,
} from '#config/defaults.ts';
import { AGENTS } from '#config/schema.ts';
import {
  assertEnvironment,
  SUBAGENT_PING,
} from '#maestro/checks/assertEnvironment.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await piTestSessions.cleanup();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('assertEnvironment', () => {
  it('given an untrusted project when the environment is checked then activation is rejected', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, events } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
      projectTrusted: false,
    });

    await expect(
      assertEnvironment({
        context: session.extensionRunner.createContext(),
        piEventsBus: events,
      }),
    ).rejects.toThrow(`Project is not trusted: "${repository.path}".`);
  });

  it('given missing Maestro agents when the environment is checked then the agent error is reported', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, events } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
      maestroAgentsAvailable: false,
    });

    await expect(
      assertEnvironment({
        context: session.extensionRunner.createContext(),
        piEventsBus: events,
      }),
    ).rejects.toThrow(
      `Builder, verifier, or simplifier agent check failed: Unknown agent: ${AGENTS.BUILDER}`,
    );
  });

  it('given invalid configuration when the environment is checked then the configuration error is reported', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
    await writeFile(
      join(repository.path, CONFIG_FILE_PATH),
      JSON.stringify({ version: 999 }),
    );

    const { session, events } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
    });

    await expect(
      assertEnvironment({
        context: session.extensionRunner.createContext(),
        piEventsBus: events,
      }),
    ).rejects.toThrow('Maestro configuration check failed:');
  });

  it('given an unavailable configured model when the environment is checked then its exact name is reported', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
    await writeFile(
      join(repository.path, CONFIG_FILE_PATH),
      JSON.stringify({
        version: DEFAULT_CONFIG_VERSION,
        builder: { model: 'openai-codex/missing' },
      }),
    );

    const { session, events } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
    });

    await expect(
      assertEnvironment({
        context: session.extensionRunner.createContext(),
        piEventsBus: events,
      }),
    ).rejects.toThrow(
      'Configured model is not available: "openai-codex/missing".',
    );
  });

  it('given a failed subagents reply when the environment is checked then the installation requirement is reported', async () => {
    const { session, events } = await piTestSessions.create({
      extensions: [],
    });

    events.on(SUBAGENT_PING.REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: Maestro emits this version 1 ping request.
      const request = payload as { requestId: string };
      events.emit(`${SUBAGENT_PING.REPLY_EVENT_PREFIX}${request.requestId}`, {
        version: SUBAGENT_PING.VERSION,
        requestId: request.requestId,
        method: SUBAGENT_PING.METHOD,
        success: false,
        error: { message: 'Unavailable' },
      });
    });

    await expect(
      assertEnvironment({
        context: session.extensionRunner.createContext(),
        piEventsBus: events,
      }),
    ).rejects.toThrow(
      `${SUBAGENT_PING.INSTALLATION_ERROR} Unsuccessful or invalid pi-subagents ping reply.`,
    );
  });

  it('given a dirty repository and absent spec directory when checks pass then no files change', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await writeFile(join(repository.path, 'README.md'), '# Original\n');

    await writeFile(
      join(repository.path, 'README.md'),
      '# Uncommitted change\n',
    );

    const { session, events } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
    });

    events.on(SUBAGENT_PING.REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: Maestro emits this version 1 ping request.
      const request = payload as { requestId: string };
      events.emit(`${SUBAGENT_PING.REPLY_EVENT_PREFIX}${request.requestId}`, {
        version: SUBAGENT_PING.VERSION,
        requestId: request.requestId,
        method: SUBAGENT_PING.METHOD,
        success: true,
        data: { version: SUBAGENT_PING.VERSION },
      });
    });

    await expect(
      assertEnvironment({
        context: session.extensionRunner.createContext(),
        piEventsBus: events,
      }),
    ).resolves.toBeUndefined();

    expect(await readFile(join(repository.path, 'README.md'), 'utf8')).toBe(
      '# Uncommitted change\n',
    );
    await expect(
      access(join(repository.path, DEFAULT_SPEC_DIRECTORY)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
