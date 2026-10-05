import { readFile, writeFile } from 'node:fs/promises';
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type { TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { createSpec } from '#specs/create.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { registerMarkSpecReadyTool } from '#tools/main/mark-spec-ready.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowPhase,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

type RegisteredTool = ToolDefinition<TSchema, unknown, unknown>;

type MarkSpecReadyInput = {
  specId: string;
};

type ExecuteToolInput = {
  repositoryRoot: string;
  input: MarkSpecReadyInput;
};

type CreateWorkflowInput = {
  phase?: WorkflowPhase;
  revision?: number;
};

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');

const SPEC_ID = '20260321-143052-add-weather-alerts';

const OTHER_SPEC_ID = '20260321-143053-other-spec';

const cleanupFunctions: Array<() => Promise<void>> = [];

const createRegisteredTool = (): RegisteredTool => {
  let registeredTool: RegisteredTool | undefined;

  // JUSTIFICATION: The fake implements only the registration method used by this test.
  const pi = {
    registerTool: (tool: RegisteredTool): void => {
      registeredTool = tool;
    },
  } as ExtensionAPI;

  registerMarkSpecReadyTool(pi);

  if (registeredTool === undefined) {
    throw new Error('Mark spec ready tool was not registered.');
  }

  return registeredTool;
};

const executeTool = async ({ repositoryRoot, input }: ExecuteToolInput) => {
  const tool = createRegisteredTool();
  // JUSTIFICATION: The adapter only reads cwd from the extension context.
  const context = { cwd: repositoryRoot } as ExtensionContext;

  return tool.execute('test-call', input, undefined, undefined, context);
};

const createWorkflow = async ({
  phase = WORKFLOW_PHASES.DRAFTING_SPEC,
  revision = 1,
}: CreateWorkflowInput = {}) => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);

  const config = await loadConfiguration({ cwd: repository.path });

  const paths = new MaestroPaths({
    repositoryRoot: repository.path,
    config,
  });

  const created = await createSpec({
    paths,
    title: 'Add Weather Alerts',
    activeWorkflowSpecId: null,
    instant: INSTANT,
  });

  if (phase !== WORKFLOW_PHASES.DRAFTING_SPEC || revision !== 1) {
    await writeWorkflowState({
      path: created.workflowPath,
      state: { ...created.state, phase, revision },
      currentRevision: created.state.revision,
    });
  }

  maestroSessionState.activate();
  maestroSessionState.setActiveSpecId(SPEC_ID);

  return { created, paths, repository };
};

afterEach(async () => {
  maestroSessionState.deactivate();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('mark spec ready tool', () => {
  it('registers a closed spec ID-only input schema', () => {
    const tool = createRegisteredTool();

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
    const { created, repository } = await createWorkflow({ revision: 7 });
    const approvedContent = '# Changed after the original draft\n';
    await writeFile(created.specFilePath, approvedContent, 'utf8');

    const result = await executeTool({
      repositoryRoot: repository.path,
      input: { specId: SPEC_ID },
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('ready-for-builder'),
      },
    ]);
    expect(result.details).toEqual({
      version: WORKFLOW_STATE_VERSION,
      specId: SPEC_ID,
      revision: 8,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    await expect(readFile(created.specFilePath, 'utf8')).resolves.toBe(
      approvedContent,
    );
    await expect(
      readWorkflowState({ path: created.workflowPath }),
    ).resolves.toEqual(result.details);
  });

  it.each([
    WORKFLOW_PHASES.ESCALATION_DECISION,
    WORKFLOW_PHASES.FINDINGS_DECISION,
  ])('approves an authorized revision from %s', async (phase) => {
    const { created, repository } = await createWorkflow({
      phase,
      revision: 2,
    });

    const result = await executeTool({
      repositoryRoot: repository.path,
      input: { specId: SPEC_ID },
    });

    expect(result.details).toEqual({
      version: WORKFLOW_STATE_VERSION,
      specId: SPEC_ID,
      revision: 3,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    await expect(
      readWorkflowState({ path: created.workflowPath }),
    ).resolves.toEqual(result.details);
  });

  it.each([
    WORKFLOW_PHASES.READY_FOR_BUILDER,
    WORKFLOW_PHASES.BUILDER_RUNNING,
    WORKFLOW_PHASES.BUILDER_FAILED,
    WORKFLOW_PHASES.READY_FOR_VERIFIER,
    WORKFLOW_PHASES.VERIFIER_RUNNING,
    WORKFLOW_PHASES.CANDIDATE_READY,
  ])('rejects approval from %s', async (phase) => {
    const { created, repository } = await createWorkflow({
      phase,
      revision: 2,
    });

    await expect(
      executeTool({
        repositoryRoot: repository.path,
        input: { specId: SPEC_ID },
      }),
    ).rejects.toThrow(
      `Workflow event "mark-spec-ready" is not allowed from phase "${phase}".`,
    );
    await expect(
      readWorkflowState({ path: created.workflowPath }),
    ).resolves.toMatchObject({ revision: 2, phase });
  });

  it('returns a domain error when the requested spec is not active', async () => {
    const { repository } = await createWorkflow();

    await expect(
      executeTool({
        repositoryRoot: repository.path,
        input: { specId: OTHER_SPEC_ID },
      }),
    ).rejects.toThrow(
      `Active workflow spec ID mismatch: expected "${OTHER_SPEC_ID}", found "${SPEC_ID}".`,
    );
  });
});
