/**
 * Objective: Verify first-use agent selection and configuration persistence.
 * Used: In integration tests with real offline Pi sessions.
 */

import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, expect, it, vi, onTestFinished } from 'vitest';

import { loadConfiguration } from '#config/loadConfiguration.ts';
import maestroExtension from '#extensions/maestro.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import * as modelPicker from '#src/ui/selectModel.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import * as piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

afterEach(() => {
  maestroSessionState.deactivate();
});

const MODEL_A = TEST_CONFIG.builder.model;

const MODEL_B = TEST_CONFIG.verifier.model;

it.each([
  {
    scenario: 'builder only',
    actions: ['Select builder', 'high', 'Confirm'],
    models: [MODEL_A],
    enabledAgents: { builder: true, verifier: false, simplifier: false },
  },
  {
    scenario: 'builder and verifier',
    actions: ['Select builder', 'high', 'Select verifier', 'medium', 'Confirm'],
    models: [MODEL_A, MODEL_B],
    enabledAgents: { builder: true, verifier: true, simplifier: false },
  },
  {
    scenario: 'cleared verifier',
    actions: [
      'Select builder',
      'high',
      'Select verifier',
      'medium',
      `Verifier: ${MODEL_B} (medium)`,
      'Confirm',
    ],
    models: [MODEL_A, MODEL_B, null],
    enabledAgents: { builder: true, verifier: false, simplifier: false },
  },
  {
    scenario: 'verifier without builder',
    actions: ['Select verifier', 'medium', 'Confirm'],
    models: [MODEL_B],
    enabledAgents: { builder: false, verifier: true, simplifier: false },
  },
  {
    scenario: 'no roles',
    actions: ['Confirm'],
    models: [],
    enabledAgents: { builder: false, verifier: false, simplifier: false },
  },
  {
    scenario: 'cancelled replacement thinking',
    actions: ['Select builder', 'high', `Builder: ${MODEL_A} (high)`, undefined, 'Confirm'],
    models: [MODEL_A, MODEL_B],
    enabledAgents: { builder: true, verifier: false, simplifier: false },
  },
  {
    scenario: 'cancelled replacement model',
    actions: ['Select builder', 'high', `Builder: ${MODEL_A} (high)`, 'Confirm'],
    models: [MODEL_A, undefined],
    enabledAgents: { builder: true, verifier: false, simplifier: false },
  },
  {
    scenario: 'cancelled new model',
    actions: ['Select verifier', 'Confirm'],
    models: [undefined],
    enabledAgents: { builder: false, verifier: false, simplifier: false },
  },
  {
    scenario: 'None for an unset verifier',
    actions: ['Select verifier', 'Confirm'],
    models: [null],
    enabledAgents: { builder: false, verifier: false, simplifier: false },
  },
  {
    scenario: 'cancelled new thinking',
    actions: ['Select verifier', undefined, 'Confirm'],
    models: [MODEL_B],
    enabledAgents: { builder: false, verifier: false, simplifier: false },
  },
])(
  'GIVEN first-use setup with $scenario WHEN the owner finishes the selectors THEN completed choices alone determine enabled agents and activation',
  async ({ actions, models, enabledAgents }) => {
    const repository = await createTemporaryProject();
    onTestFinished(repository.cleanup);

    const { session, notify } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [maestroExtension],
    });

    const ui = { ...session.extensionRunner.getUIContext() };
    const select = vi.spyOn(ui, 'select');

    for (const action of actions) select.mockResolvedValueOnce(action);
    select.mockResolvedValue('New spec');
    const custom = vi.spyOn(ui, 'custom');

    for (const model of models) custom.mockResolvedValueOnce(model);
    session.extensionRunner.setUIContext(ui, 'tui');
    const mainModel = session.model;

    await session.prompt('/maestro');

    expect(select.mock.calls[0]).toEqual([
      'Maestro setup — spec-only mode',
      ['Select builder', 'Select verifier', 'Select simplifier', 'Select scorer', 'Confirm'],
      undefined,
    ]);
    expect(session.model).toBe(mainModel);
    expect(maestroSessionState.isActive()).toBe(true);

    const saved = JSON.parse(await readFile(join(repository.path, '.pi/maestro.json'), 'utf8'));
    expect(saved.specDirectory).toBe('.specs');
    expect(saved.scorer).toEqual({ required: false });
    expect({
      builder: saved.builder.required,
      verifier: saved.verifier.required,
      simplifier: saved.simplifier.required,
    }).toEqual(enabledAgents);

    expect(saved.builder).toEqual(
      enabledAgents.builder
        ? { required: true, model: MODEL_A, thinking: 'high' }
        : { required: false },
    );
    expect(saved.verifier).toEqual(
      enabledAgents.verifier
        ? { required: true, model: MODEL_B, thinking: 'medium' }
        : { required: false },
    );

    const verifierLabel = enabledAgents.builder
      ? `Verifier: ${MODEL_B} (medium)`
      : `Verifier: ${MODEL_B} (medium) — skipped without a Builder`;

    expect(
      select.mock.calls.filter(([title]) => title.startsWith('Maestro setup')).at(-1)?.[1],
    ).toEqual([
      enabledAgents.builder ? `Builder: ${MODEL_A} (high)` : 'Select builder',
      enabledAgents.verifier ? verifierLabel : 'Select verifier',
      'Select simplifier',
      'Select scorer',
      'Confirm',
    ]);
    expect(
      select.mock.calls
        .filter(([title]) => title === 'Select thinking')
        .map(([, choices]) => choices[0]),
    ).toEqual(select.mock.calls.filter(([title]) => title === 'Select thinking').map(() => 'off'));

    await expect(loadConfiguration(repository.path)).resolves.toMatchObject({
      builder: { required: enabledAgents.builder },
    });
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining('Maestro active'), 'info');
  },
);

it('GIVEN Pi levels beginning with minimal and a completed high selection WHEN builder is replaced THEN both thinking dialogs receive Pi order and the new first choice replaces high', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const registry = session.extensionRunner.createContext().modelRegistry;

  const available = registry.getAvailable().map((model) => ({
    ...model,
    thinkingLevelMap: { off: null },
  }));

  vi.spyOn(registry, 'getAvailable').mockReturnValue(available);
  const ui = { ...session.extensionRunner.getUIContext() };

  const select = vi
    .spyOn(ui, 'select')
    .mockResolvedValueOnce('Select builder')
    .mockResolvedValueOnce('high')
    .mockResolvedValueOnce(`Builder: ${MODEL_A} (high)`)
    .mockResolvedValueOnce('minimal')
    .mockResolvedValueOnce('Confirm')
    .mockResolvedValue('New spec');

  vi.spyOn(ui, 'custom').mockResolvedValueOnce(MODEL_A).mockResolvedValueOnce(MODEL_B);
  session.extensionRunner.setUIContext(ui, 'tui');

  await session.prompt('/maestro');

  expect(
    select.mock.calls
      .filter(([title]) => title === 'Select thinking')
      .map(([, choices]) => choices),
  ).toEqual([
    ['minimal', 'low', 'medium', 'high'],
    ['minimal', 'low', 'medium', 'high'],
  ]);
  expect(select.mock.calls.filter(([title]) => title === 'Maestro setup').at(-1)?.[1][0]).toBe(
    `Builder: ${MODEL_B} (minimal)`,
  );
  const saved = JSON.parse(await readFile(join(repository.path, '.pi/maestro.json'), 'utf8'));
  expect(saved.builder).toEqual({ required: true, model: MODEL_B, thinking: 'minimal' });
  expect(maestroSessionState.isActive()).toBe(true);
});

it('GIVEN unsaved builder selection WHEN Escape closes the main screen THEN configuration remains absent and Maestro stays inactive', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const ui = { ...session.extensionRunner.getUIContext() };
  vi.spyOn(ui, 'select')
    .mockResolvedValueOnce('Select builder')
    .mockResolvedValueOnce('high')
    .mockResolvedValueOnce(undefined);
  vi.spyOn(ui, 'custom').mockResolvedValueOnce(MODEL_A);
  session.extensionRunner.setUIContext(ui, 'tui');
  await session.prompt('/maestro');
  await expect(access(join(repository.path, '.pi/maestro.json'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  expect(maestroSessionState.isActive()).toBe(false);
});

it('GIVEN an available classifier and chat model WHEN the scorer is selected and setup confirmed THEN only classifiers are offered and the selection is saved without thinking', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const registry = session.extensionRunner.createContext().modelRegistry;
  const classifier = registry.getModelOfType('classifier', 'openrouter', 'typesafe/jev-1.14');

  if (!classifier) throw new Error('Test catalog lacks classifier.');
  vi.spyOn(registry, 'getAvailableOfType').mockResolvedValue([classifier]);
  const ui = { ...session.extensionRunner.getUIContext() };

  const select = vi
    .spyOn(ui, 'select')
    .mockResolvedValueOnce('Select scorer')
    .mockResolvedValueOnce('Confirm')
    .mockResolvedValue('New spec');

  vi.spyOn(ui, 'custom').mockResolvedValueOnce('openrouter/typesafe/jev-1.14');
  const picker = vi.spyOn(modelPicker, 'selectModel');
  onTestFinished(() => picker.mockRestore());
  session.extensionRunner.setUIContext(ui, 'tui');

  await session.prompt('/maestro');

  expect(registry.getAvailable()).toContainEqual(expect.objectContaining({ id: 'gpt-6.1-sol' }));
  expect(picker).toHaveBeenCalledWith(
    expect.objectContaining({ choices: ['openrouter/typesafe/jev-1.14'] }),
  );
  expect(select.mock.calls.map(([title]) => title)).toEqual([
    'Maestro setup — spec-only mode',
    'Maestro setup — spec-only mode',
    'Start Maestro workflow',
  ]);
  expect(select.mock.calls[1]?.[1]).toContain(
    'Scorer: openrouter/typesafe/jev-1.14 — skipped without a Builder',
  );
  const saved = JSON.parse(await readFile(join(repository.path, '.pi/maestro.json'), 'utf8'));
  expect(saved.scorer).toEqual({ required: true, model: 'openrouter/typesafe/jev-1.14' });
  expect(maestroSessionState.isActive()).toBe(true);
});
