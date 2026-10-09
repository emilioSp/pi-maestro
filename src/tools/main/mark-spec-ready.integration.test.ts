import { readFile, writeFile } from 'node:fs/promises';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { createSpec } from '#specs/create.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { createTemporaryProject } from '#test/support/temp-repository.ts';
import { registerMarkSpecReadyTool } from '#tools/main/mark-spec-ready.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
} from '#workflow/state/schema.ts';

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');

const SPEC_ID = '20260321-143052-add-weather-alerts';

const OTHER_SPEC_ID = '20260321-143053-other-spec';

const cleanupFunctions: Array<() => Promise<void>> = [];

const createWorkflow = async () => {
  const repository = await createTemporaryProject();
  cleanupFunctions.push(repository.cleanup);

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
  it('registers a closed spec ID-only input schema', async () => {
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

  it('approves the current spec from drafting without comparing its content', async () => {
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
    await expect(readFile(created.specFilePath, 'utf8')).resolves.toBe(
      approvedContent,
    );
    await expect(readWorkflowState(created.workflowPath)).resolves.toEqual(
      result.details,
    );
  });

  it('returns a domain error when the requested spec is not active', async () => {
    const { repository } = await createWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerMarkSpecReadyTool,
    });

    await expect(
      tool.execute('test-call', { specId: OTHER_SPEC_ID }),
    ).rejects.toThrow(
      `Active workflow spec ID mismatch: expected "${OTHER_SPEC_ID}", found "${SPEC_ID}".`,
    );
  });
});
