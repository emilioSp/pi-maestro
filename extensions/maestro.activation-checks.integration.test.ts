/**
 * Objective: Verify activation checks and notices for saved configurations.
 * Used: In integration tests with real offline Pi sessions.
 */

import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stripTerminalSequences } from '@earendil-works/pi-tui';
import { afterEach, expect, it, vi, onTestFinished } from 'vitest';

import { saveConfiguration } from '#config/saveConfiguration.ts';
import { SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';
import maestroExtension from '#extensions/maestro.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { SPEC_ID } from '#tests/support/builder-workflow.ts';
import {
  BASE_TOOLS,
  MAIN_TOOL_NAMES,
  chooseNewSpec,
  foreignExtension,
  writeMaestroTestConfig,
} from '#tests/support/maestro-extension.ts';
import * as piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

afterEach(() => {
  maestroSessionState.deactivate();
});

it('GIVEN one existing spec and an unavailable verifier model WHEN activation is requested THEN the workflow menu appears before the model error stops activation', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  const model = 'openrouter/~openai/gpt-mini-latest';
  await writeMaestroTestConfig({
    cwd: repository.path,
    config: { ...TEST_CONFIG, verifier: { required: true, model } },
  });
  await mkdir(join(repository.path, '.specs', SPEC_ID), { recursive: true });

  const { session, notify } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const ui = { ...session.extensionRunner.getUIContext() };
  const select = vi.spyOn(ui, 'select').mockResolvedValueOnce('New spec');
  session.extensionRunner.setUIContext(ui, 'tui');

  await session.prompt('/maestro');

  expect(select.mock.calls[0]?.[0]).toBe('Start Maestro workflow');
  expect(maestroSessionState.isActive()).toBe(false);
  expect(notify).toHaveBeenCalledWith(`Configured model is not available: "${model}".`, 'error');
});

it('GIVEN custom agent configuration WHEN Maestro is enabled THEN the activation notice lists the provider, model, and thinking level for each agent', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await writeMaestroTestConfig({
    cwd: repository.path,
    config: {
      version: SUPPORTED_CONFIG_VERSION,
      builder: {
        model: 'openai-codex/gpt-6.1-sol',
        thinking: THINKING_LEVELS.XHIGH,
      },
      verifier: {
        model: 'openai-codex/gpt-6.1-sol',
        thinking: THINKING_LEVELS.HIGH,
      },
      simplifier: {
        required: true,
        model: TEST_CONFIG.simplifier.model,
        thinking: THINKING_LEVELS.MEDIUM,
      },
    },
  });

  const { session, notify } = await piTestSessions.create({
    extensions: [maestroExtension],
    cwd: repository.path,
  });

  chooseNewSpec(session);
  await session.prompt('/maestro');
  const theme = session.extensionRunner.createContext().ui.theme;

  expect(notify).toHaveBeenCalledExactlyOnceWith(
    [
      theme.fg('muted', 'Maestro active'),
      'Maestro helps the owner define a spec, then coordinates implementation and independent verification.',
      'Ask how Maestro works for a short explanation.',
      theme.fg('accent', 'Builder (openai-codex/gpt-6.1-sol xhigh)'),
      theme.fg('accent', 'Verifier (openai-codex/gpt-6.1-sol high)'),
      theme.fg('accent', 'Simplifier (openai-codex/gpt-6.1-sol medium)'),
    ].join('\n'),
    'info',
  );
});

it.each([
  {
    scenario: 'builder only',
    builder: true,
    verifier: false,
    simplifier: false,
    scorer: false,
    expectedAgents: [`Builder (${TEST_CONFIG.builder.model} ${TEST_CONFIG.builder.thinking})`],
  },
  {
    scenario: 'builder and verifier',
    builder: true,
    verifier: true,
    simplifier: false,
    scorer: false,
    expectedAgents: [
      `Builder (${TEST_CONFIG.builder.model} ${TEST_CONFIG.builder.thinking})`,
      `Verifier (${TEST_CONFIG.verifier.model} ${TEST_CONFIG.verifier.thinking})`,
    ],
  },
  {
    scenario: 'builder and simplifier',
    builder: true,
    verifier: false,
    simplifier: true,
    scorer: false,
    expectedAgents: [
      `Builder (${TEST_CONFIG.builder.model} ${TEST_CONFIG.builder.thinking})`,
      `Simplifier (${TEST_CONFIG.simplifier.model} ${TEST_CONFIG.simplifier.thinking})`,
    ],
  },
  {
    scenario: 'builder and scorer',
    builder: true,
    verifier: false,
    simplifier: false,
    scorer: true,
    expectedAgents: [
      `Builder (${TEST_CONFIG.builder.model} ${TEST_CONFIG.builder.thinking})`,
      `Scorer (${TEST_CONFIG.scorer.model})`,
    ],
  },
  {
    scenario: 'builder disabled despite enabled later phases',
    builder: false,
    verifier: true,
    simplifier: true,
    scorer: true,
    expectedAgents: [],
  },
])(
  'GIVEN $scenario WHEN Maestro is activated THEN the notice lists only enabled agents',
  async ({ builder, verifier, simplifier, scorer, expectedAgents }) => {
    const repository = await createTemporaryProject();
    onTestFinished(repository.cleanup);
    await writeMaestroTestConfig({
      cwd: repository.path,
      config: {
        version: SUPPORTED_CONFIG_VERSION,
        builder: { ...TEST_CONFIG.builder, required: builder },
        verifier: { ...TEST_CONFIG.verifier, required: verifier },
        simplifier: { ...TEST_CONFIG.simplifier, required: simplifier },
        scorer: { ...TEST_CONFIG.scorer, required: scorer },
      },
    });

    const { session, notify } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [maestroExtension],
    });

    chooseNewSpec(session);
    await session.prompt('/maestro');

    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0][1]).toBe('info');
    expect(stripTerminalSequences(notify.mock.calls[0][0]).split('\n').slice(3)).toEqual(
      expectedAgents,
    );
  },
);

it('GIVEN an unavailable simplifier model WHEN activation is requested THEN Maestro stays disabled and reports which model is unavailable', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await writeMaestroTestConfig({
    cwd: repository.path,
    config: {
      ...TEST_CONFIG,
      simplifier: { required: true, model: 'openai-codex/missing' },
    },
  });

  const { session, notify } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  chooseNewSpec(session);
  await session.prompt('/maestro');
  expect(maestroSessionState.isActive()).toBe(false);
  expect(notify).toHaveBeenCalledExactlyOnceWith(
    'Configured model is not available: "openai-codex/missing".',
    'error',
  );
});

it('GIVEN an untrusted project with valid configuration WHEN activation is requested THEN Maestro activates without requiring project trust', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await saveConfiguration({
    cwd: repository.path,
    agentModelSelections: {
      builder: TEST_CONFIG.builder,
      verifier: TEST_CONFIG.verifier,
      simplifier: TEST_CONFIG.simplifier,
    },
  });

  const { session, notify } = await piTestSessions.create({
    extensions: [foreignExtension, maestroExtension],
    cwd: repository.path,
    projectTrusted: false,
  });

  chooseNewSpec(session);
  await session.prompt('/maestro');

  expect(maestroSessionState.isActive()).toBe(true);
  expect(session.getActiveToolNames()).toEqual([...BASE_TOOLS, ...MAIN_TOOL_NAMES]);
  expect(notify).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('Maestro active'), 'info');
});

it('GIVEN an existing configuration missing the enabled verifier model WHEN activation is requested THEN the file stays unchanged and setup is not opened', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  const input = { ...TEST_CONFIG, verifier: { required: true } };
  await writeMaestroTestConfig({ cwd: repository.path, config: input });
  const before = await readFile(join(repository.path, '.pi/maestro.json'), 'utf8');

  const { session, notify } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const ui = { ...session.extensionRunner.getUIContext() };
  const select = vi.spyOn(ui, 'select').mockResolvedValue('New spec');
  const custom = vi.spyOn(ui, 'custom');
  session.extensionRunner.setUIContext(ui, 'tui');
  await session.prompt('/maestro');
  expect(maestroSessionState.isActive()).toBe(false);
  expect(notify).toHaveBeenCalledWith('Configured model is not available: "".', 'error');
  expect(select).toHaveBeenCalledExactlyOnceWith(
    'Start Maestro workflow',
    ['New spec', 'Agent models'],
    undefined,
  );
  expect(custom).not.toHaveBeenCalled();
  expect(await readFile(join(repository.path, '.pi/maestro.json'), 'utf8')).toBe(before);
});

it('GIVEN builder enabled and both later phases disabled without models WHEN activation is requested THEN Maestro activates using only the builder model', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await saveConfiguration({
    cwd: repository.path,
    agentModelSelections: { builder: TEST_CONFIG.builder },
  });

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  chooseNewSpec(session);
  await session.prompt('/maestro');
  expect(maestroSessionState.isActive()).toBe(true);
});

it('GIVEN builder is disabled and scorer is enabled without a model WHEN Maestro is activated THEN spec-only activation succeeds', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await writeMaestroTestConfig({
    cwd: repository.path,
    config: {
      version: SUPPORTED_CONFIG_VERSION,
      builder: { required: false },
      scorer: { required: true },
    },
  });

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  chooseNewSpec(session);
  await session.prompt('/maestro');

  expect(maestroSessionState.isActive()).toBe(true);
});

it.each([
  { label: 'missing', scorer: { required: true } },
  { label: 'empty', scorer: { required: true, model: '' } },
])(
  'GIVEN an enabled builder and $label scorer model WHEN Maestro is activated THEN activation rejects the missing scorer model',
  async ({ scorer }) => {
    const repository = await createTemporaryProject();
    onTestFinished(repository.cleanup);
    await writeMaestroTestConfig({ cwd: repository.path, config: { ...TEST_CONFIG, scorer } });

    const { session, notify } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [maestroExtension],
    });

    chooseNewSpec(session);
    await session.prompt('/maestro');

    expect(maestroSessionState.isActive()).toBe(false);
    expect(notify).toHaveBeenCalledWith(
      'Scorer model is required when scorer.required is true.',
      'error',
    );
  },
);
