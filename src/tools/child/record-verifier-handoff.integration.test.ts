import { access, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type { TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { registerRecordVerifierHandoffTool } from '#tools/child/record-verifier-handoff.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

const createRegisteredTool = () => {
  type RegisteredTool = ToolDefinition<TSchema, unknown, unknown>;

  let registeredTool: RegisteredTool | undefined;

  // JUSTIFICATION: The fake implements only the registration method used by this test.
  const pi = {
    registerTool: (tool: RegisteredTool): void => {
      // JUSTIFICATION: The test erases the registration generic to invoke the captured tool.
      registeredTool = tool;
    },
  } as ExtensionAPI;

  registerRecordVerifierHandoffTool(pi);

  if (registeredTool === undefined) {
    throw new Error('Verifier handoff tool was not registered.');
  }

  return registeredTool;
};

const createHandoffInput = () => ({
  specId: SPEC_ID,
  summary: 'The candidate satisfies the approved specification.',
  acceptanceCriteria: [],
  findings: [],
  notes: [],
});

const executeTool = async ({
  repositoryRoot,
  input,
}: {
  repositoryRoot: string;
  input: ReturnType<typeof createHandoffInput>;
}) => {
  const tool = createRegisteredTool();
  // JUSTIFICATION: The adapter only reads cwd from the extension context.
  const context = { cwd: repositoryRoot } as ExtensionContext;

  return tool.execute('test-call', input, undefined, undefined, context);
};

afterEach(cleanupBuilderWorkflows);

describe('verifier handoff tool', () => {
  it('registers a closed input schema with explicit verifier identity', () => {
    const tool = createRegisteredTool();
    const input = createHandoffInput();

    expect(Value.Check(tool.parameters, input)).toBe(true);
    expect(Value.Check(tool.parameters, { ...input, branch: 'main' })).toBe(
      false,
    );
    expect(
      Value.Check(tool.parameters, {
        ...input,
        findings: [
          {
            id: 'F1',
            acceptanceCriterion: null,
            severity: 'high',
            confidence: 1,
            summary: 'Finding',
            evidence: [{ source: 'test', observation: 'Observed' }],
            rejection: { reason: 'Rejected' },
          },
        ],
      }),
    ).toBe(false);
  });

  it('rejects a handoff outside the verifier-running phase', async () => {
    const workflow = await createApprovedWorkflow();

    await expect(
      executeTool({
        repositoryRoot: workflow.repository.path,
        input: createHandoffInput(),
      }),
    ).rejects.toThrow(
      'Verifier handoff requires verifier-running state, found "ready-for-builder".',
    );
  });

  it('rejects a workflow spec identity mismatch', async () => {
    const workflow = await createApprovedWorkflow();
    const statePath = workflow.paths.getWorkflowPath(SPEC_ID);
    const state = await readWorkflowState({ path: statePath });

    await writeFile(
      statePath,
      `${JSON.stringify(
        { ...state, specId: '20260321-143052-other-spec' },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await expect(
      executeTool({
        repositoryRoot: workflow.repository.path,
        input: createHandoffInput(),
      }),
    ).rejects.toThrow(
      `Workflow spec ID mismatch: expected "${SPEC_ID}", found "20260321-143052-other-spec".`,
    );
  });

  it('writes and commits only the verifier protocol files', async () => {
    const workflow = await createApprovedWorkflow();
    await prepareBuilderLaunch({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    await completeBuilderPass({
      paths: workflow.paths,
      specId: SPEC_ID,
      handoff: {
        status: 'done',
        summary: 'Implemented the approved change.',
        acceptanceCriteria: [],
        notes: [],
      },
    });
    await commitAll({
      path: workflow.repository.path,
      message: 'Builder completed',
    });

    const verifierLaunch = await prepareVerifierLaunch({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    const result = await executeTool({
      repositoryRoot: workflow.repository.path,
      input: createHandoffInput(),
    });

    expect(result.details).toMatchObject({
      candidateCommit: verifierLaunch.candidateCommit,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      revision: verifierLaunch.revision + 1,
      specId: SPEC_ID,
    });
    await expect(
      readWorkflowState({
        path: workflow.paths.getWorkflowPath(SPEC_ID),
      }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
    await expect(
      getRepositoryStatus({ repositoryRoot: workflow.repository.path }),
    ).resolves.toMatchObject({
      clean: true,
      staged: [],
      unstaged: [],
      untracked: [],
    });

    const commitFiles = await runGitCommand({
      arguments: ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'],
      cwd: workflow.repository.path,
    });

    expect(commitFiles.stdout.trim().split(/\r?\n/).sort()).toEqual(
      [
        relative(
          workflow.repository.path,
          workflow.paths.getVerifierHandoffPath(SPEC_ID),
        ),
        relative(
          workflow.repository.path,
          workflow.paths.getWorkflowPath(SPEC_ID),
        ),
      ].sort(),
    );
    await expect(
      getHeadCommit({ repositoryRoot: workflow.repository.path }),
    ).resolves.not.toBe(verifierLaunch.checkpointCommit);
  });

  it('rejects product changes without writing or committing protocol files', async () => {
    const workflow = await createApprovedWorkflow();
    await prepareBuilderLaunch({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    await completeBuilderPass({
      paths: workflow.paths,
      specId: SPEC_ID,
      handoff: {
        status: 'done',
        summary: 'Implemented the approved change.',
        acceptanceCriteria: [],
        notes: [],
      },
    });
    await commitAll({
      path: workflow.repository.path,
      message: 'Builder completed',
    });
    await prepareVerifierLaunch({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    const headBefore = await getHeadCommit({
      repositoryRoot: workflow.repository.path,
    });

    await writeFile(
      `${workflow.repository.path}/README.md`,
      '# Changed product\n',
      'utf8',
    );

    const result = await executeTool({
      repositoryRoot: workflow.repository.path,
      input: createHandoffInput(),
    });

    expect(result).toMatchObject({
      details: {
        error: 'PRODUCT_FILES_MODIFIED',
      },
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Product files differ from the candidate commit. Restore the candidate before submitting the verifier handoff.',
      },
    ]);
    await expect(
      getHeadCommit({ repositoryRoot: workflow.repository.path }),
    ).resolves.toBe(headBefore);
    await expect(
      readWorkflowState({
        path: workflow.paths.getWorkflowPath(SPEC_ID),
      }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.VERIFIER_RUNNING });
    await expect(
      access(workflow.paths.getVerifierHandoffPath(SPEC_ID)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
