import { readFile } from 'node:fs/promises';
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type { TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import type { CreatedSpec } from '#specs/create.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { registerCreateSpecTool } from '#tools/main/create-spec.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
} from '#workflow/state/schema.ts';

type RegisteredTool = ToolDefinition<TSchema, unknown, unknown>;

type CreateSpecInput = {
  title: string;
};

type ExecuteToolInput = {
  repositoryRoot: string;
  input: CreateSpecInput;
};

const cleanupFunctions: Array<() => Promise<void>> = [];

const createRegisteredTool = (): RegisteredTool => {
  let registeredTool: RegisteredTool | undefined;

  // JUSTIFICATION: The fake implements only the registration method used by this test.
  const pi = {
    registerTool: (tool: RegisteredTool): void => {
      registeredTool = tool;
    },
  } as ExtensionAPI;

  registerCreateSpecTool(pi);

  if (registeredTool === undefined) {
    throw new Error('Create spec tool was not registered.');
  }

  return registeredTool;
};

const executeTool = async ({ repositoryRoot, input }: ExecuteToolInput) => {
  const tool = createRegisteredTool();
  // JUSTIFICATION: The adapter only reads cwd from the extension context.
  const context = { cwd: repositoryRoot } as ExtensionContext;

  return tool.execute('test-call', input, undefined, undefined, context);
};

afterEach(async () => {
  maestroSessionState.deactivate();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('create spec tool', () => {
  it('registers a closed title-only input schema', () => {
    const tool = createRegisteredTool();

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
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    maestroSessionState.activate();

    const result = await executeTool({
      repositoryRoot: repository.path,
      input: { title: 'Add Weather Alerts' },
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

    await expect(
      readWorkflowState({ path: details.workflowPath }),
    ).resolves.toEqual({
      version: WORKFLOW_STATE_VERSION,
      specId: details.specId,
      revision: 1,
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    });

    const workflowState = await readWorkflowState({
      path: details.workflowPath,
    });

    expect(Object.keys(workflowState).sort()).toEqual([
      'phase',
      'revision',
      'specId',
      'version',
    ]);
  });

  it('returns the domain error when another workflow is active', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId('20260321-143052-current-workflow');

    await expect(
      executeTool({
        repositoryRoot: repository.path,
        input: { title: 'Add Weather Alerts' },
      }),
    ).rejects.toThrow(
      'Workflow 20260321-143052-current-workflow is already active.',
    );
  });
});
