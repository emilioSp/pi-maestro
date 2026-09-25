import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { readEscalation } from '#artifacts/escalation/readEscalation.ts';
import {
  type NewEscalation,
  NewEscalationSchema,
} from '#artifacts/escalation/schema.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import {
  BUILDER_ESCALATION_TOOL,
  registerOpenEscalationTool,
} from '#tools/child/open-escalation.ts';
import { pathExists } from '#utils/path-exists.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

const ESCALATION_INPUT: NewEscalation = {
  question: 'Which adapter should the builder use?',
  context: 'The approved contract allows two implementation approaches.',
  options: [
    {
      id: 'A',
      description: 'Use the existing adapter.',
      consequences: 'The current lifecycle remains unchanged.',
      nextStep: 'Extend the existing adapter.',
    },
    {
      id: 'B',
      description: 'Add a new adapter.',
      consequences: 'The implementation gains a separate lifecycle.',
      nextStep: 'Create the new adapter.',
    },
  ],
  recommendation: null,
  notes: [],
};

const getRegisteredTool = (): ToolDefinition => {
  const tools: ToolDefinition[] = [];
  const pi = {
    registerTool: (tool: ToolDefinition) => tools.push(tool),
  } as unknown as ExtensionAPI;

  registerOpenEscalationTool({ pi });

  const tool = tools[0];

  if (tool === undefined || tool.name !== BUILDER_ESCALATION_TOOL.NAME) {
    throw new Error('Open escalation tool was not registered.');
  }

  return tool;
};

const createToolContext = ({ cwd }: { cwd: string }): ExtensionContext =>
  ({ cwd }) as ExtensionContext;

describe('open escalation tool', () => {
  it('validates a closed input schema without protocol identity fields', () => {
    const tool = getRegisteredTool();

    expect(Value.Check(tool.parameters, ESCALATION_INPUT)).toBe(true);
    expect(
      Value.Check(NewEscalationSchema, { ...ESCALATION_INPUT, id: 'E1' }),
    ).toBe(false);
    expect(
      Value.Check(NewEscalationSchema, {
        ...ESCALATION_INPUT,
        options: [],
      }),
    ).toBe(false);
    expect(
      Value.Check(NewEscalationSchema, {
        ...ESCALATION_INPUT,
        recommendation: {
          optionId: 'A',
          reason: 'It follows the current architecture.',
          specId: SPEC_ID,
        },
      }),
    ).toBe(false);
  });

  it('uses committed custom directories and workflow state for protocol fields', async () => {
    const specDirectory = 'custom/specs';
    const worktreeDirectory = 'custom/worktrees';
    const { paths, builderWorktreePath } = await createApprovedWorkflow({
      specDirectory,
      worktreeDirectory,
    });
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const tool = getRegisteredTool();

    const result = await tool.execute(
      'call-id',
      ESCALATION_INPUT,
      undefined,
      undefined,
      createToolContext({ cwd: builderWorktreePath }),
    );

    const escalationPath = paths.getEscalationPathInWorktree({
      specId: SPEC_ID,
      escalationNumber: 1,
      worktreePath: builderWorktreePath,
    });
    const workflowPath = paths.getWorkflowPathInWorktree({
      specId: SPEC_ID,
      worktreePath: builderWorktreePath,
    });

    expect(result.details).toMatchObject({ escalationPath });

    await expect(
      readEscalation({
        path: escalationPath,
        specId: SPEC_ID,
        currentRevision: launch.revision + 1,
      }),
    ).resolves.toMatchObject({
      id: 'E1',
      specId: SPEC_ID,
      revision: launch.revision + 1,
      recommendation: null,
      resolution: null,
    });
    await expect(
      readWorkflowState({ path: workflowPath }),
    ).resolves.toMatchObject({
      specId: SPEC_ID,
      revision: launch.revision + 1,
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
    });
    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      escalationId: 'E1',
      revision: launch.revision + 1,
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
    });

    await expect(
      tool.execute(
        'second-call',
        ESCALATION_INPUT,
        undefined,
        undefined,
        createToolContext({ cwd: builderWorktreePath }),
      ),
    ).rejects.toThrow(
      'Builder escalation requires builder-running state, found "escalation-decision".',
    );
    await expect(
      pathExists(
        paths.getEscalationPathInWorktree({
          specId: SPEC_ID,
          escalationNumber: 2,
          worktreePath: builderWorktreePath,
        }),
      ),
    ).resolves.toBe(false);
  });

  it('returns a domain error and leaves the workflow unchanged for an unknown recommendation', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const tool = getRegisteredTool();
    const invalidRecommendation: NewEscalation = {
      ...ESCALATION_INPUT,
      recommendation: {
        optionId: 'unknown',
        reason: 'This option does not exist.',
      },
    };

    await expect(
      tool.execute(
        'call-id',
        invalidRecommendation,
        undefined,
        undefined,
        createToolContext({ cwd: builderWorktreePath }),
      ),
    ).rejects.toThrow('Escalation recommendation references unknown option');

    await expect(
      readWorkflowState({
        path: paths.getWorkflowPathInWorktree({
          specId: SPEC_ID,
          worktreePath: builderWorktreePath,
        }),
      }),
    ).resolves.toMatchObject({
      revision: launch.revision,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
    await expect(
      pathExists(
        paths.getEscalationPathInWorktree({
          specId: SPEC_ID,
          escalationNumber: 1,
          worktreePath: builderWorktreePath,
        }),
      ),
    ).resolves.toBe(false);
  });
});
