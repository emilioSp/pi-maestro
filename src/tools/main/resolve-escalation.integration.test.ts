import { readFile, writeFile } from 'node:fs/promises';
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type { TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { readEscalation } from '#artifacts/escalation/readEscalation.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { registerResolveEscalationTool } from '#tools/main/resolve-escalation.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

type RegisteredTool = ToolDefinition<TSchema, unknown, unknown>;

type ResolveEscalationInput = {
  specId: string;
  escalationId: string;
  selectedOptionId: string | null;
  decision: string;
  reason: string;
};

type ExecuteToolInput = {
  repositoryRoot: string;
  input: ResolveEscalationInput;
};

const createRegisteredTool = (): RegisteredTool => {
  let registeredTool: RegisteredTool | undefined;

  // JUSTIFICATION: The fake implements only the registration method used by this test.
  const pi = {
    registerTool: (tool: RegisteredTool): void => {
      registeredTool = tool;
    },
  } as ExtensionAPI;

  registerResolveEscalationTool(pi);

  if (registeredTool === undefined) {
    throw new Error('Resolve escalation tool was not registered.');
  }

  return registeredTool;
};

const executeTool = async ({ repositoryRoot, input }: ExecuteToolInput) => {
  const tool = createRegisteredTool();
  // JUSTIFICATION: The adapter only reads cwd from the extension context.
  const context = { cwd: repositoryRoot } as ExtensionContext;

  return tool.execute('test-call', input, undefined, undefined, context);
};

const openEscalation = async () => {
  const workflow = await createApprovedWorkflow();
  await prepareBuilderLaunch({ paths: workflow.paths, specId: SPEC_ID });

  const opened = await openBuilderEscalation({
    paths: workflow.paths,
    specId: SPEC_ID,
    escalation: {
      question: 'Which behavior should the builder use?',
      context: 'The approved contract allows two valid behaviors.',
      options: [
        {
          id: 'option-a',
          description: 'Use option A.',
          consequences: 'Keeps the implementation small.',
          nextStep: 'Implement option A.',
        },
      ],
      recommendation: null,
      notes: [],
    },
  });

  return { ...workflow, opened };
};

afterEach(cleanupBuilderWorkflows);

describe('resolve escalation tool', () => {
  it('registers a closed owner decision input schema', () => {
    const tool = createRegisteredTool();

    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        escalationId: 'E1',
        selectedOptionId: 'option-a',
        decision: 'Use option A.',
        reason: 'It matches the approved contract.',
      }),
    ).toBe(true);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        escalationId: 'E1',
        selectedOptionId: null,
        decision: 'Choose a different implementation.',
        reason: 'The listed options do not fit the repository.',
      }),
    ).toBe(true);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        escalationId: 'E1',
        selectedOptionId: 'option-a',
        decision: 'Use option A.',
      }),
    ).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        escalationId: 'E1',
        selectedOptionId: 'option-a',
        decision: 'Use option A.',
        reason: 'It matches the approved contract.',
        phase: WORKFLOW_PHASES.ESCALATION_DECISION,
      }),
    ).toBe(false);
  });

  it('records the explicit decision and commits ready-for-builder on the current branch', async () => {
    const { paths, repository, opened } = await openEscalation();
    const specBefore = await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8');

    const result = await executeTool({
      repositoryRoot: repository.path,
      input: {
        specId: SPEC_ID,
        escalationId: opened.escalation.id,
        selectedOptionId: 'option-a',
        decision: 'Use option A.',
        reason: 'It matches the approved contract.',
      },
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('ready-for-builder'),
      },
    ]);
    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      escalationId: opened.escalation.id,
      revision: opened.state.revision + 1,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      repositoryRoot: repository.path,
    });

    // JUSTIFICATION: The adapter returns the checkpoint commit in its structured details.
    const details = result.details as {
      checkpointCommit: string;
    };

    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(details.checkpointCommit);
    await expect(
      readFile(paths.getSpecFilePath(SPEC_ID), 'utf8'),
    ).resolves.toBe(specBefore);
    await expect(
      readEscalation({
        path: opened.escalationPath,
        specId: SPEC_ID,
        currentRevision: opened.state.revision + 1,
      }),
    ).resolves.toMatchObject({
      ...opened.escalation,
      revision: opened.state.revision + 1,
      resolution: {
        selectedOptionId: 'option-a',
        decision: 'Use option A.',
        reason: 'It matches the approved contract.',
      },
    });
  });

  it('leaves the unresolved escalation unchanged when the owner revises the spec', async () => {
    const { paths, opened } = await openEscalation();
    const revisedSpec = '# Revised contract\n';
    await writeFile(paths.getSpecFilePath(SPEC_ID), revisedSpec, 'utf8');

    const state = await markSpecReady({
      paths,
      specId: SPEC_ID,
      activeWorkflowSpecId: SPEC_ID,
    });

    expect(state.phase).toBe(WORKFLOW_PHASES.READY_FOR_BUILDER);
    await expect(
      readFile(paths.getSpecFilePath(SPEC_ID), 'utf8'),
    ).resolves.toBe(revisedSpec);
    await expect(
      readEscalation({
        path: opened.escalationPath,
        specId: SPEC_ID,
        currentRevision: state.revision,
      }),
    ).resolves.toMatchObject({
      ...opened.escalation,
      resolution: null,
    });
  });

  it('returns a domain error without resolving an old escalation', async () => {
    const { paths, opened, repository } = await openEscalation();

    await expect(
      executeTool({
        repositoryRoot: repository.path,
        input: {
          specId: SPEC_ID,
          escalationId: 'E2',
          selectedOptionId: 'option-a',
          decision: 'Use option A.',
          reason: 'It matches the approved contract.',
        },
      }),
    ).rejects.toThrow(`expected "${opened.escalation.id}"`);

    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({
      revision: opened.state.revision,
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
    });
    await expect(
      readEscalation({
        path: opened.escalationPath,
        specId: SPEC_ID,
        currentRevision: opened.state.revision,
      }),
    ).resolves.toMatchObject({ resolution: null });
  });
});
