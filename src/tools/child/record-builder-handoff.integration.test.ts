import { join } from 'node:path';
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoffSubmission,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import {
  builderHandoffPath,
  builderWorkflowPath,
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { registerRecordBuilderHandoffTool } from '#tools/child/record-builder-handoff.ts';
import { pathExists } from '#utils/path-exists.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

const DONE_INPUT: BuilderHandoffSubmission = {
  status: BUILDER_HANDOFF_STATUSES.DONE,
  summary: 'Implemented the approved change.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test',
      probeStatus: PROBE_STATUSES.PASSED,
      breakageStatus: BREAKAGE_STATUSES.CONFIRMED,
    },
  ],
  notes: [],
};

const FAILED_INPUT: BuilderHandoffSubmission = {
  status: BUILDER_HANDOFF_STATUSES.FAILED,
  summary: 'The builder could not complete the approved change.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test',
      probeStatus: PROBE_STATUSES.NOT_RUN,
      breakageStatus: BREAKAGE_STATUSES.NOT_RUN,
    },
  ],
  failure: { reason: 'The implementation was blocked.' },
  notes: [],
};

const getRegisteredTool = (): ToolDefinition => {
  const tools: ToolDefinition[] = [];
  const pi = {
    registerTool: (tool: ToolDefinition) => tools.push(tool),
  } as unknown as ExtensionAPI;

  registerRecordBuilderHandoffTool({ pi });

  const tool = tools[0];

  if (tool === undefined || tool.name !== 'maestro_record_builder_handoff') {
    throw new Error('Builder handoff tool was not registered.');
  }

  return tool;
};

const createToolContext = ({ cwd }: { cwd: string }): ExtensionContext =>
  ({ cwd }) as ExtensionContext;

describe('record builder handoff tool', () => {
  it('accepts closed done and failed input shapes but rejects protocol identity fields', () => {
    const tool = getRegisteredTool();

    expect(Value.Check(tool.parameters, DONE_INPUT)).toBe(true);
    expect(Value.Check(tool.parameters, FAILED_INPUT)).toBe(true);
    expect(
      Value.Check(tool.parameters, {
        ...DONE_INPUT,
        specId: SPEC_ID,
        revision: 2,
      }),
    ).toBe(false);
  });

  it('writes identity and revision from the current workflow state', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const tool = getRegisteredTool();

    const result = await tool.execute(
      'call-id',
      DONE_INPUT,
      undefined,
      undefined,
      createToolContext({ cwd: builderWorktreePath }),
    );

    await expect(
      readBuilderHandoff({
        path: builderHandoffPath(builderWorktreePath),
        specId: SPEC_ID,
        revision: launch.revision + 1,
      }),
    ).resolves.toMatchObject({
      specId: SPEC_ID,
      revision: launch.revision + 1,
      status: BUILDER_HANDOFF_STATUSES.DONE,
    });
    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({
      revision: launch.revision + 1,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    });
    expect(result.details).toMatchObject({
      specId: SPEC_ID,
      revision: launch.revision + 1,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    });
    const textContent = result.content[0];

    if (textContent?.type !== 'text') {
      throw new Error('Builder handoff tool did not return text.');
    }

    expect(textContent.text).toContain('Commit your implementation');
  });

  it('uses the committed spec and worktree directories in the child worktree', async () => {
    const specDirectory = 'custom/specs';
    const worktreeDirectory = 'custom/worktrees';
    const { paths, builderWorktreePath } = await createApprovedWorkflow({
      specDirectory,
      worktreeDirectory,
    });
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const tool = getRegisteredTool();

    await tool.execute(
      'call-id',
      DONE_INPUT,
      undefined,
      undefined,
      createToolContext({ cwd: builderWorktreePath }),
    );

    await expect(
      readBuilderHandoff({
        path: join(
          builderWorktreePath,
          specDirectory,
          SPEC_ID,
          'handoffs',
          'builder.json',
        ),
        specId: SPEC_ID,
        revision: launch.revision + 1,
      }),
    ).resolves.toMatchObject({ status: BUILDER_HANDOFF_STATUSES.DONE });
    await expect(
      readWorkflowState({
        path: join(
          builderWorktreePath,
          specDirectory,
          SPEC_ID,
          'workflow.json',
        ),
      }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.READY_FOR_VERIFIER });
  });

  it('records a failed result with its required reason', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const tool = getRegisteredTool();

    await tool.execute(
      'call-id',
      FAILED_INPUT,
      undefined,
      undefined,
      createToolContext({ cwd: builderWorktreePath }),
    );

    await expect(
      readBuilderHandoff({
        path: builderHandoffPath(builderWorktreePath),
        specId: SPEC_ID,
        revision: launch.revision + 1,
      }),
    ).resolves.toMatchObject({
      specId: SPEC_ID,
      revision: launch.revision + 1,
      status: BUILDER_HANDOFF_STATUSES.FAILED,
      failure: FAILED_INPUT.failure,
    });
    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_FAILED });
  });

  it('returns a domain validation error without changing either file', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const tool = getRegisteredTool();
    const invalidInput: BuilderHandoffSubmission = {
      ...DONE_INPUT,
      acceptanceCriteria: [
        {
          id: 'AC1',
          probe: 'npm test',
          probeStatus: PROBE_STATUSES.FAILED,
          breakageStatus: BREAKAGE_STATUSES.NOT_CONFIRMED,
        },
      ],
    };

    await expect(
      tool.execute(
        'call-id',
        invalidInput,
        undefined,
        undefined,
        createToolContext({ cwd: builderWorktreePath }),
      ),
    ).rejects.toThrow('Done builder handoff requires every probe to pass');

    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({
      revision: launch.revision,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
    await expect(
      pathExists(builderHandoffPath(builderWorktreePath)),
    ).resolves.toBe(false);
  });

  it('rejects a failed handoff without a reason during artifact validation', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const tool = getRegisteredTool();
    const missingFailure = { ...FAILED_INPUT, failure: undefined };

    await expect(
      tool.execute(
        'call-id',
        missingFailure as unknown as BuilderHandoffSubmission,
        undefined,
        undefined,
        createToolContext({ cwd: builderWorktreePath }),
      ),
    ).rejects.toThrow('Invalid builder handoff');

    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_RUNNING });
    await expect(
      pathExists(builderHandoffPath(builderWorktreePath)),
    ).resolves.toBe(false);
  });
});
