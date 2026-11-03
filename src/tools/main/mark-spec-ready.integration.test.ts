import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfiguration } from '#config/loadConfiguration.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { registerMarkSpecReadyTool } from '#tools/main/mark-spec-ready.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, WORKFLOW_STATE_VERSION } from '#workflow/state/schema.ts';

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

  if (flags !== undefined) {
    await mkdir(join(repository.path, '.pi'));
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

  maestroSessionState.activate();
  maestroSessionState.setActiveSpecId(SPEC_ID);

  return { created, paths, repository };
};

afterEach(async () => {
  await piTestSessions.cleanup();
  maestroSessionState.deactivate();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('mark spec ready tool', () => {
  it('given spec approval inputs when the tool schema is checked then a valid spec ID is accepted but invalid IDs and extra fields are rejected', async () => {
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

  it('given the active draft was edited after creation when the approval tool runs then it saves ready-for-builder without changing the edited spec', async () => {
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

  it('given one spec is active when approval is requested for another spec then approval fails with an active spec ID mismatch error', async () => {
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
  'given builder disabled with verifier=$verifier and simplifier=$simplifier when the draft is approved then candidate-ready is saved without delegation',
  async ({ verifier, simplifier }) => {
    const { repository, created } = await createWorkflow({ builder: false, verifier, simplifier });

    const { tool, emit } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerMarkSpecReadyTool,
    });

    const result = await tool.execute('approve-spec-only', { specId: SPEC_ID });
    expect(result.details).toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
    await expect(readWorkflowState(created.workflowPath)).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
    expect(emit).not.toHaveBeenCalled();
    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('Builder, verifier, and simplifier skipped') },
    ]);
  },
);
