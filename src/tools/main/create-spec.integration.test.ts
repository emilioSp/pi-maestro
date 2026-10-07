import { readFile } from 'node:fs/promises';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import type { CreatedSpec } from '#specs/create.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { createTemporaryProject } from '#test/support/temp-repository.ts';
import { registerCreateSpecTool } from '#tools/main/create-spec.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
} from '#workflow/state/schema.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await piTestSessions.cleanup();
  maestroSessionState.deactivate();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('create spec tool', () => {
  it('registers a closed title-only input schema', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerCreateSpecTool,
    });

    expect(Value.Check(tool.parameters, { title: 'Add Weather Alerts' })).toBe(
      true,
    );
    expect(Value.Check(tool.parameters, {})).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        title: 'Add Weather Alerts',
        baseBranch: 'main',
      }),
    ).toBe(false);
  });

  it('creates a drafting spec and returns its paths and state', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    maestroSessionState.activate();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerCreateSpecTool,
    });

    const result = await tool.execute('test-call', {
      title: 'Add Weather Alerts',
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('created in drafting-spec phase'),
      },
    ]);

    // JUSTIFICATION: The create-spec adapter returns the domain CreatedSpec as details.
    const details = result.details as CreatedSpec;
    expect(details.specId).toMatch(/^\d{8}-\d{6}-add-weather-alerts$/);
    expect(maestroSessionState.getActiveSpecId()).toBe(details.specId);
    await expect(readFile(details.specFilePath, 'utf8')).resolves.toContain(
      `# ${details.specId}: Add Weather Alerts`,
    );

    await expect(readWorkflowState(details.workflowPath)).resolves.toEqual({
      version: WORKFLOW_STATE_VERSION,
      specId: details.specId,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });
  });

  it('returns the domain error when another workflow is active', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId('20260321-143052-current-workflow');

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerCreateSpecTool,
    });

    await expect(
      tool.execute('test-call', { title: 'Add Weather Alerts' }),
    ).rejects.toThrow(
      'Workflow 20260321-143052-current-workflow is already active.',
    );
  });
});
