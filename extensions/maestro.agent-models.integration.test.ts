/**
 * Objective: Verify edits to saved agent models before activation.
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
import { writeMaestroTestConfig } from '#tests/support/maestro-extension.ts';
import * as piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

const MODEL_A = TEST_CONFIG.builder.model;

const MODEL_B = TEST_CONFIG.verifier.model;

afterEach(() => {
  maestroSessionState.deactivate();
});

it('GIVEN one existing spec WHEN the owner replaces the builder model then starts a new spec THEN the file keeps the other settings and the notice shows the new model', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await writeMaestroTestConfig({
    cwd: repository.path,
    config: {
      version: SUPPORTED_CONFIG_VERSION,
      specDirectory: 'planning/specs',
      builder: TEST_CONFIG.builder,
      verifier: { required: false },
      simplifier: { required: false },
      scorer: { required: false },
    },
  });
  await mkdir(join(repository.path, 'planning/specs', SPEC_ID), { recursive: true });

  const { session, notify } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const ui = { ...session.extensionRunner.getUIContext() };

  const select = vi
    .spyOn(ui, 'select')
    .mockResolvedValueOnce('Agent models')
    .mockResolvedValueOnce(`Builder: ${MODEL_A} (high)`)
    .mockResolvedValueOnce(THINKING_LEVELS.LOW)
    .mockResolvedValueOnce('Confirm')
    .mockResolvedValueOnce('New spec');

  vi.spyOn(ui, 'custom').mockResolvedValueOnce(MODEL_B);
  session.extensionRunner.setUIContext(ui, 'tui');

  await session.prompt('/maestro');

  expect(select.mock.calls[1]).toEqual([
    'Maestro setup',
    [
      `Builder: ${MODEL_A} (high)`,
      'Select verifier',
      'Select simplifier',
      'Select scorer',
      'Confirm',
    ],
    undefined,
  ]);
  expect(JSON.parse(await readFile(join(repository.path, '.pi/maestro.json'), 'utf8'))).toEqual({
    version: SUPPORTED_CONFIG_VERSION,
    specDirectory: 'planning/specs',
    builder: { required: true, model: MODEL_B, thinking: THINKING_LEVELS.LOW },
    verifier: { required: false },
    simplifier: { required: false },
    scorer: { required: false },
  });
  expect(stripTerminalSequences(notify.mock.calls.at(-1)?.[0] ?? '')).toContain(
    `Builder (${MODEL_B} ${THINKING_LEVELS.LOW})`,
  );
  expect(maestroSessionState.isActive()).toBe(true);
});

it('GIVEN saved builder and verifier models WHEN the owner clears verifier then closes the agent menu THEN the configuration file is unchanged and the workflow menu returns', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await saveConfiguration({
    cwd: repository.path,
    agentModelSelections: { builder: TEST_CONFIG.builder, verifier: TEST_CONFIG.verifier },
  });
  await mkdir(join(repository.path, '.specs', SPEC_ID), { recursive: true });
  const before = await readFile(join(repository.path, '.pi/maestro.json'), 'utf8');

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const ui = { ...session.extensionRunner.getUIContext() };

  const select = vi
    .spyOn(ui, 'select')
    .mockResolvedValueOnce('Agent models')
    .mockResolvedValueOnce(`Verifier: ${MODEL_B} (medium)`)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce('New spec');

  vi.spyOn(ui, 'custom').mockResolvedValueOnce(null);
  session.extensionRunner.setUIContext(ui, 'tui');

  await session.prompt('/maestro');

  expect(select.mock.calls.map(([title]) => title)).toEqual([
    'Start Maestro workflow',
    'Maestro setup',
    'Maestro setup',
    'Start Maestro workflow',
  ]);
  expect(select.mock.calls[2]?.[1]).toContain('Select verifier');
  expect(await readFile(join(repository.path, '.pi/maestro.json'), 'utf8')).toBe(before);
  expect(maestroSessionState.isActive()).toBe(true);
});

it.each([
  {
    role: 'simplifier',
    builder: TEST_CONFIG.builder,
    label: `Simplifier: ${TEST_CONFIG.simplifier.model} (low)`,
  },
  {
    role: 'scorer',
    builder: { required: false },
    label: `Scorer: ${TEST_CONFIG.scorer.model} — skipped without a Builder`,
  },
] as const)(
  'GIVEN a saved $role model WHEN the owner clears it and confirms THEN only that role is disabled',
  async ({ role, builder, label }) => {
    const repository = await createTemporaryProject();
    onTestFinished(repository.cleanup);

    const config = {
      ...TEST_CONFIG,
      builder,
      simplifier: { ...TEST_CONFIG.simplifier, thinking: 'low' },
    };

    const configPath = await writeMaestroTestConfig({ cwd: repository.path, config: config });

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [maestroExtension],
    });

    const ui = { ...session.extensionRunner.getUIContext() };

    const select = vi
      .spyOn(ui, 'select')
      .mockResolvedValueOnce('Agent models')
      .mockResolvedValueOnce(label)
      .mockResolvedValueOnce('Confirm');

    vi.spyOn(ui, 'custom').mockResolvedValueOnce(null);
    session.extensionRunner.setUIContext(ui, 'tui');

    await session.prompt('/maestro');

    expect(select.mock.calls[1]?.[1]).toContain(label);
    expect(select.mock.calls[2]?.[1]).toContain(`Select ${role}`);
    expect(select.mock.calls.map(([title]) => title)).not.toContain('Select thinking');
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({
      ...config,
      [role]: { required: false },
    });
  },
);

it('GIVEN all roles are selected WHEN the owner clears Builder and later selects a replacement THEN the other roles stay saved and are no longer skipped', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);

  const config = {
    ...TEST_CONFIG,
    simplifier: { ...TEST_CONFIG.simplifier, thinking: 'low' },
  };

  const configPath = await writeMaestroTestConfig({ cwd: repository.path, config: config });

  const { session, notify } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const ui = { ...session.extensionRunner.getUIContext() };

  const select = vi
    .spyOn(ui, 'select')
    .mockResolvedValueOnce('Agent models')
    .mockResolvedValueOnce(`Builder: ${MODEL_A} (high)`)
    .mockResolvedValueOnce('Confirm');

  const custom = vi.spyOn(ui, 'custom').mockResolvedValueOnce(null);
  session.extensionRunner.setUIContext(ui, 'tui');

  await session.prompt('/maestro');

  const skippedMenu = [
    'Select builder',
    `Verifier: ${MODEL_B} (medium) — skipped without a Builder`,
    `Simplifier: ${MODEL_A} (low) — skipped without a Builder`,
    `Scorer: ${config.scorer.model} — skipped without a Builder`,
    'Confirm',
  ];

  expect(select).toHaveBeenLastCalledWith(
    'Start Maestro workflow',
    ['New spec', 'Agent models'],
    undefined,
  );
  expect(select.mock.calls[2]).toEqual(['Maestro setup — spec-only mode', skippedMenu, undefined]);
  expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({
    ...config,
    builder: { required: false },
  });

  select.mockClear();
  select
    .mockResolvedValueOnce('Agent models')
    .mockResolvedValueOnce('Select builder')
    .mockResolvedValueOnce('high')
    .mockResolvedValueOnce('Confirm')
    .mockResolvedValueOnce('New spec');
  custom.mockResolvedValueOnce(MODEL_B);
  await session.prompt('/maestro');

  expect(select.mock.calls[1]).toEqual(['Maestro setup — spec-only mode', skippedMenu, undefined]);
  expect(select.mock.calls[3]?.[1]).toEqual([
    `Builder: ${MODEL_B} (high)`,
    `Verifier: ${MODEL_B} (medium)`,
    `Simplifier: ${MODEL_A} (low)`,
    `Scorer: ${config.scorer.model}`,
    'Confirm',
  ]);
  expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({
    ...config,
    builder: { required: true, model: MODEL_B, thinking: 'high' },
  });
  const activation = stripTerminalSequences(notify.mock.calls.at(-1)?.[0] ?? '');
  expect(activation).toContain(`Verifier (${MODEL_B} medium)`);
  expect(activation).toContain(`Simplifier (${MODEL_A} low)`);
  expect(activation).toContain(`Scorer (${config.scorer.model})`);
});
