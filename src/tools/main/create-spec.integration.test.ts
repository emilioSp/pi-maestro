import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';

import { saveConfiguration } from '#config/saveConfiguration.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import type { CreatedSpec } from '#specs/create.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { registerCreateSpecTool } from '#tools/main/create-spec.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, WORKFLOW_STATE_VERSION } from '#workflow/state/schema.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await piTestSessions.cleanup();
  maestroSessionState.deactivate();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('create spec tool', () => {
  it('GIVEN spec creation inputs WHEN the tool schema is checked THEN a title is required and extra fields are rejected', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerCreateSpecTool,
    });

    expect(Value.Check(tool.parameters, { title: 'Add Weather Alerts' })).toBe(true);
    expect(Value.Check(tool.parameters, {})).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        title: 'Add Weather Alerts',
        baseBranch: 'main',
      }),
    ).toBe(false);
  });

  it('GIVEN no active workflow WHEN the create-spec tool runs THEN it selects the new spec, saves its draft and workflow, and returns their paths', async () => {
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

    await expect(readFile(details.proposalFilePath, 'utf8')).resolves.toContain(
      `# ${details.specId}: Add Weather Alerts`,
    );
    expect(details.designFilePath).toBe(join(details.specPath, 'design.md'));
    await expect(readWorkflowState(details.workflowPath)).resolves.toEqual({
      version: WORKFLOW_STATE_VERSION,
      specId: details.specId,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });
  });

  it('GIVEN a workflow is already active WHEN the create-spec tool runs THEN creation fails and the error names the active workflow', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId('20260321-143052-current-workflow');
    await saveConfiguration({
      cwd: repository.path,
      agentModelSelections: {
        builder: TEST_CONFIG.builder,
        verifier: TEST_CONFIG.verifier,
        simplifier: TEST_CONFIG.simplifier,
      },
    });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerCreateSpecTool,
    });

    await expect(tool.execute('test-call', { title: 'Add Weather Alerts' })).rejects.toThrow(
      'Workflow 20260321-143052-current-workflow is already active.',
    );
  });
});
