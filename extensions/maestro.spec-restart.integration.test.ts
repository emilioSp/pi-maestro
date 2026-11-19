/**
 * Objective: Verify how the owner selects and restarts an existing spec.
 * Used: In integration tests with real offline Pi sessions.
 */

import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, expect, it, vi, onTestFinished } from 'vitest';

import { saveConfiguration } from '#config/saveConfiguration.ts';
import maestroExtension from '#extensions/maestro.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { createApprovedWorkflow, SPEC_ID } from '#tests/support/builder-workflow.ts';
import * as piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

afterEach(() => {
  maestroSessionState.deactivate();
});

it('GIVEN two existing specs WHEN the owner presses Escape in the restart list THEN the workflow menu returns before activation', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await saveConfiguration({ cwd: repository.path, agentModelSelections: {} });
  const ids = ['20261101-100000-add-search', '20261102-100000-add-filter'];

  for (const id of ids) await mkdir(join(repository.path, '.specs', id), { recursive: true });

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const ui = { ...session.extensionRunner.getUIContext() };

  const select = vi
    .spyOn(ui, 'select')
    .mockResolvedValueOnce('Restart spec')
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce('New spec');

  session.extensionRunner.setUIContext(ui, 'tui');
  await session.prompt('/maestro');
  expect(select.mock.calls.map(([title, choices]) => [title, choices])).toEqual([
    ['Start Maestro workflow', ['New spec', 'Restart spec', 'Agent models']],
    ['Restart spec', ids],
    ['Start Maestro workflow', ['New spec', 'Restart spec', 'Agent models']],
  ]);
  expect(maestroSessionState.isActive()).toBe(true);
});

it.each(Object.values(WORKFLOW_PHASES))(
  'GIVEN a saved %s spec WHEN the owner restarts it THEN the same spec is active in saved drafting-spec',
  async (phase) => {
    const { paths, repository } = await createApprovedWorkflow();
    const workflowPath = paths.getWorkflowPath(SPEC_ID);
    await writeWorkflowState({
      path: workflowPath,
      state: { version: '1.0.0', specId: SPEC_ID, phase },
    });
    const directories = await readdir(paths.getSpecDirectory());

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [maestroExtension],
    });

    const ui = { ...session.extensionRunner.getUIContext() };
    vi.spyOn(ui, 'select').mockResolvedValueOnce('Restart spec').mockResolvedValueOnce(SPEC_ID);
    session.extensionRunner.setUIContext(ui, 'tui');
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    expect(maestroSessionState.getActiveSpecId()).toBe(SPEC_ID);
    expect(await readWorkflowState(workflowPath)).toEqual({
      version: '1.0.0',
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });
    expect(await readdir(paths.getSpecDirectory())).toEqual(directories);
  },
);

it.each(['empty', 'absent'])(
  'GIVEN an %s configured spec directory WHEN activation is requested THEN the workflow menu omits restart and Maestro activates without spec creation',
  async (directory) => {
    const repository = await createTemporaryProject();
    onTestFinished(repository.cleanup);
    await saveConfiguration({ cwd: repository.path, agentModelSelections: {} });

    if (directory === 'empty') await mkdir(join(repository.path, '.specs'));

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [maestroExtension],
    });

    const ui = { ...session.extensionRunner.getUIContext() };
    const select = vi.spyOn(ui, 'select').mockResolvedValue('New spec');
    session.extensionRunner.setUIContext(ui, 'tui');
    await session.prompt('/maestro');
    expect(select).toHaveBeenCalledExactlyOnceWith(
      'Start Maestro workflow',
      ['New spec', 'Agent models'],
      undefined,
    );
    expect(maestroSessionState.isActive()).toBe(true);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();

    const entries = await readdir(join(repository.path, '.specs')).catch(
      (error: NodeJS.ErrnoException) => error.code,
    );

    expect(entries).toEqual(directory === 'empty' ? [] : 'ENOENT');
  },
);
