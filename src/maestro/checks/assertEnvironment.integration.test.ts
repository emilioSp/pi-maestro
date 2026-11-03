/**
 * Objective: Check Maestro's read-only activation requirements.
 * Used: In integration tests with isolated Pi environments and controlled ping replies.
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONFIG_DIRECTORY_NAME,
  CONFIG_FILE_PATH,
  DEFAULT_CONFIG_VERSION,
  DEFAULT_SPEC_DIRECTORY,
} from '#config/defaults.ts';
import { AGENTS } from '#config/schema.ts';
import { assertEnvironment, SUBAGENT_PING } from '#maestro/checks/assertEnvironment.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await piTestSessions.cleanup();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('assertEnvironment', () => {
  it('given an untrusted project when activation requirements are checked then the check fails and identifies the untrusted project path', async () => {
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

  it('given Maestro agents are unavailable when activation requirements are checked then the check fails and identifies the missing builder agent', async () => {
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

  it('given configuration has a numeric version when activation requirements are checked then the check fails with a configuration error', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
    await writeFile(join(repository.path, CONFIG_FILE_PATH), JSON.stringify({ version: 999 }));

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

  it.each(['builder', 'verifier', 'simplifier'])(
    'given the %s model is absent from Pi’s registry when activation is checked then it reports the full unavailable ID',
    async (agent) => {
      const repository = await createTemporaryProject();
      cleanupFunctions.push(repository.cleanup);
      const model = 'openrouter/~openai/gpt-mini-latest';
      await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
      await writeFile(
        join(repository.path, CONFIG_FILE_PATH),
        JSON.stringify({
          version: DEFAULT_CONFIG_VERSION,
          [agent]: { model },
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
      ).rejects.toThrow(`Configured model is not available: "${model}".`);
    },
  );

  it('given pi-subagents replies that its availability check failed when activation requirements are checked then the error reports the installation requirement and invalid reply', async () => {
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

  it('given an edited README and no spec directory when activation requirements pass then the README stays unchanged and no spec directory is created', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await writeFile(join(repository.path, 'README.md'), '# Original\n');

    await writeFile(join(repository.path, 'README.md'), '# Uncommitted change\n');

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
    await expect(access(join(repository.path, DEFAULT_SPEC_DIRECTORY))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

it.each([
  { verifier: false, simplifier: true, available: ['builder', 'simplifier'] },
  { verifier: true, simplifier: false, available: ['builder', 'verifier'] },
  { verifier: false, simplifier: false, available: ['builder'] },
])(
  'given verifier=$verifier and simplifier=$simplifier with only enabled agents and models available when activation is checked then it succeeds with one pi-subagents availability check',
  async ({ verifier, simplifier, available }) => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
    await writeFile(
      join(repository.path, CONFIG_FILE_PATH),
      JSON.stringify({
        version: DEFAULT_CONFIG_VERSION,
        verifier: { required: verifier, ...(!verifier ? { model: 'missing/verifier' } : {}) },
        simplifier: {
          required: simplifier,
          ...(!simplifier ? { model: 'missing/simplifier' } : {}),
        },
      }),
    );

    const { session, events } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
      maestroAgentsAvailable: available,
    });

    const ping = vi.fn<(payload: unknown) => void>((payload) => {
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

    events.on(SUBAGENT_PING.REQUEST_EVENT, ping);
    await expect(
      assertEnvironment({ context: session.extensionRunner.createContext(), piEventsBus: events }),
    ).resolves.toBeUndefined();
    expect(ping).toHaveBeenCalledOnce();
  },
);

it.each([
  { verifier: false, simplifier: false },
  { verifier: false, simplifier: true },
  { verifier: true, simplifier: false },
  { verifier: true, simplifier: true },
])(
  'given builder disabled with verifier=$verifier and simplifier=$simplifier and no agents or models when activation is checked then it succeeds without a ping or model lookup',
  async ({ verifier, simplifier }) => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
    await writeFile(
      join(repository.path, CONFIG_FILE_PATH),
      JSON.stringify({
        version: DEFAULT_CONFIG_VERSION,
        builder: { required: false, model: 'missing/builder' },
        verifier: { required: verifier, model: 'missing/verifier' },
        simplifier: { required: simplifier, model: 'missing/simplifier' },
      }),
    );

    const { session, events } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
      maestroAgentsAvailable: false,
    });

    const context = session.extensionRunner.createContext();
    const available = vi.spyOn(context.modelRegistry, 'getAvailable').mockReturnValue([]);
    const emit = vi.spyOn(events, 'emit');
    await expect(assertEnvironment({ context, piEventsBus: events })).resolves.toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
    expect(available).not.toHaveBeenCalled();
  },
);
