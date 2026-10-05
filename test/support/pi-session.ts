/**
 * Objective: Create isolated, offline Pi sessions for integration tests.
 * Used: When tests need real extension registration, contexts, commands, or events.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type AgentSession,
  createAgentSession,
  createEventBus,
  DefaultResourceLoader,
  type ExtensionError,
  type ExtensionFactory,
  ModelRuntime,
  SessionManager,
  type SessionStartEvent,
  SettingsManager,
  wrapRegisteredTool,
} from '@earendil-works/pi-coding-agent';
import { expect, vi } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';

type CreatePiSessionInput = {
  cwd?: string;
  extensions: ExtensionFactory[];
  projectTrusted?: boolean;
  maestroAgentsAvailable?: boolean;
  sessionStartEvent?: SessionStartEvent;
};

type CreateRegisteredToolInput = {
  cwd?: string;
  extension: ExtensionFactory;
};

type PiSessionResource = {
  directory: string;
  session?: AgentSession;
  errors: ExtensionError[];
};

class PiTestSessions {
  private readonly resources: PiSessionResource[] = [];

  public create = async ({
    cwd,
    extensions,
    projectTrusted = true,
    maestroAgentsAvailable = true,
    sessionStartEvent,
  }: CreatePiSessionInput) => {
    const directory = await mkdtemp(join(tmpdir(), 'pi-maestro-session-'));
    const errors: ExtensionError[] = [];
    const resource: PiSessionResource = { directory, errors };
    this.resources.push(resource);
    const agentDir = join(directory, 'agent');
    await mkdir(agentDir);
    vi.stubEnv('PI_CODING_AGENT_DIR', agentDir);
    vi.stubEnv('HOME', directory);
    vi.stubEnv('PI_OFFLINE', '1');
    vi.stubEnv('PI_SUBAGENT_EXTRA_AGENT_DIRS', '');

    // Real preflight discovers this package's agent files, not personal Pi resources.
    await writeFile(
      join(agentDir, 'settings.json'),
      JSON.stringify({
        packages: maestroAgentsAvailable
          ? [dirname(fileURLToPath(import.meta.resolve('#package.json')))]
          : [],
      }),
    );

    const modelRuntime = await ModelRuntime.create({
      authPath: join(agentDir, 'auth.json'),
      modelsPath: null,
      allowModelNetwork: false,
      refreshOnCreate: false,
    });

    modelRuntime.registerProvider('openai-codex', {
      api: 'openai-completions',
      apiKey: 'offline-test-key',
      baseUrl: 'http://127.0.0.1:1',
      models: [DEFAULT_CONFIG.builder.model, DEFAULT_CONFIG.verifier.model].map(
        (model) => ({
          id: model.split('/')[1],
          name: model,
          reasoning: true,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 4096,
          maxTokens: 1024,
        }),
      ),
      streamSimple: () => {
        throw new Error('Live model calls are not allowed in tests.');
      },
    });
    await modelRuntime.refresh({ allowNetwork: false });

    const settingsManager = SettingsManager.inMemory(
      {
        compaction: { enabled: false },
        retry: { enabled: false },
        cacheWarming: 'off',
      },
      { projectTrusted },
    );

    const events = createEventBus();

    const resourceLoader = new DefaultResourceLoader({
      cwd: cwd ?? directory,
      agentDir,
      settingsManager,
      eventBus: events,
      extensionFactories: extensions,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
    });

    await resourceLoader.reload();
    expect(resourceLoader.getExtensions().errors).toEqual([]);

    const { session } = await createAgentSession({
      cwd: cwd ?? directory,
      agentDir,
      resourceLoader,
      settingsManager,
      modelRuntime,
      model: modelRuntime.getModel(
        'openai-codex',
        DEFAULT_CONFIG.builder.model.split('/')[1],
      ),
      sessionManager: SessionManager.inMemory(cwd ?? directory),
      sessionStartEvent,
    });

    resource.session = session;
    // Observe Pi's own headless UI methods. No replacement ExtensionAPI or context is needed.
    const ui = { ...session.extensionRunner.getUIContext() };
    const notify = vi.spyOn(ui, 'notify');
    const setStatus = vi.spyOn(ui, 'setStatus');
    await session.bindExtensions({
      uiContext: ui,
      onError: (error) => errors.push(error),
    });

    return {
      session,
      events,
      notify,
      setStatus,
      settingsManager,
    };
  };

  public createRegisteredTool = async ({
    cwd,
    extension,
  }: CreateRegisteredToolInput) => {
    const createdSession = await this.create({ cwd, extensions: [extension] });
    const { session, events } = createdSession;
    const registeredTools = session.extensionRunner.getAllRegisteredTools();
    expect(registeredTools).toHaveLength(1);

    const tool = wrapRegisteredTool(
      registeredTools[0],
      session.extensionRunner,
    );

    const emit = vi.spyOn(events, 'emit');
    const subscribe = events.on.bind(events);

    // Observe cleanup while preserving the real EventBus subscription and unsubscribe.
    const on = vi
      .spyOn(events, 'on')
      .mockImplementation((channel, handler) =>
        vi.fn(subscribe(channel, handler)),
      );

    return { ...createdSession, tool, emit, on };
  };

  public cleanup = async (): Promise<void> => {
    const resources = this.resources.splice(0);

    try {
      for (const resource of resources) resource.session?.dispose();
      await Promise.all(
        resources.map(({ directory }) =>
          rm(directory, { recursive: true, force: true }),
        ),
      );

      for (const { errors } of resources) expect(errors).toEqual([]);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  };
}

export default new PiTestSessions();
