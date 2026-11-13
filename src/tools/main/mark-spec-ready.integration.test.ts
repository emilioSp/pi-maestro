import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Value } from 'typebox/value';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfiguration } from '#config/loadConfiguration.ts';
import { saveConfiguration } from '#config/saveConfiguration.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import { executeTask } from '#src/delegation/executeTask.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { registerMarkSpecReadyTool } from '#tools/main/mark-spec-ready.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, WORKFLOW_STATE_VERSION } from '#workflow/state/schema.ts';

vi.mock('#src/delegation/executeTask.ts', () => ({ executeTask: vi.fn<typeof executeTask>() }));

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');

const SPEC_ID = '20260321-143052-add-weather-alerts';

const OTHER_SPEC_ID = '20260321-143053-other-spec';

const cleanupFunctions: Array<() => Promise<void>> = [];

type PhaseFlags = {
  builder: boolean;
  verifier: boolean;
  simplifier: boolean;
};

const createWorkflow = async (flags?: PhaseFlags) => {
  const repository = await createTemporaryProject();
  cleanupFunctions.push(repository.cleanup);

  await saveConfiguration({
    cwd: repository.path,
    agentModelSelections: {
      builder: TEST_CONFIG.builder,
      verifier: TEST_CONFIG.verifier,
      simplifier: TEST_CONFIG.simplifier,
    },
  });

  if (flags !== undefined) {
    await mkdir(join(repository.path, '.pi'), { recursive: true });
    await writeFile(
      join(repository.path, '.pi/maestro.json'),
      JSON.stringify({
        version: '1.0.0',
        builder: { required: flags.builder },
        verifier: { required: flags.verifier },
        simplifier: { required: flags.simplifier },
      }),
    );
  }

  const config = await loadConfiguration(repository.path);

  const paths = new MaestroPaths({
    projectRoot: repository.path,
    config,
  });

  const created = await createSpec({
    paths,
    title: 'Add Weather Alerts',
    activeWorkflowSpecId: null,
    instant: INSTANT,
  });

  return { created, paths, repository };
};

afterEach(async () => {
  vi.mocked(executeTask).mockReset();
  await piTestSessions.cleanup();
  maestroSessionState.deactivate();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('mark spec ready tool', () => {
  it('GIVEN spec approval inputs WHEN the tool schema is checked THEN a valid spec ID is accepted but invalid IDs and extra fields are rejected', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerMarkSpecReadyTool,
    });

    expect(Value.Check(tool.parameters, { specId: SPEC_ID })).toBe(true);
    expect(Value.Check(tool.parameters, { specId: 'invalid' })).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      }),
    ).toBe(false);
  });

  it('GIVEN the active draft was edited after creation WHEN the approval tool runs THEN it saves ready-for-builder without changing the edited spec', async () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const { created, repository } = await createWorkflow();
    const approvedContent = '# Changed after the original draft\n';
    await writeFile(created.specFilePath, approvedContent, 'utf8');

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerMarkSpecReadyTool,
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(WORKFLOW_PHASES.READY_FOR_BUILDER),
      },
    ]);
    expect(result.details).toEqual({
      version: WORKFLOW_STATE_VERSION,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    await expect(readFile(created.specFilePath, 'utf8')).resolves.toBe(approvedContent);
    await expect(readWorkflowState(created.workflowPath)).resolves.toEqual(result.details);
  });

  it('GIVEN one spec is active WHEN approval is requested for another spec THEN approval fails with an active spec ID mismatch error', async () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const { repository } = await createWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerMarkSpecReadyTool,
    });

    await expect(tool.execute('test-call', { specId: OTHER_SPEC_ID })).rejects.toThrow(
      `Active workflow spec ID mismatch: expected "${OTHER_SPEC_ID}", found "${SPEC_ID}".`,
    );
  });
});

it.each([
  { verifier: false, simplifier: false },
  { verifier: false, simplifier: true },
  { verifier: true, simplifier: false },
  { verifier: true, simplifier: true },
])(
  'GIVEN builder disabled with verifier=$verifier and simplifier=$simplifier WHEN the draft is approved THEN candidate-ready is saved without delegation',
  async ({ verifier, simplifier }) => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const { repository, created } = await createWorkflow({ builder: false, verifier, simplifier });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerMarkSpecReadyTool,
    });

    const result = await tool.execute('approve-spec-only', { specId: SPEC_ID });
    expect(result.details).toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
    await expect(readWorkflowState(created.workflowPath)).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
    expect(executeTask).not.toHaveBeenCalled();
    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('Builder, verifier, and simplifier skipped') },
    ]);
  },
);
