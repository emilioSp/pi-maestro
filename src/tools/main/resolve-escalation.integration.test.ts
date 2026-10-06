import { readFile, writeFile } from 'node:fs/promises';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { readEscalation } from '#artifacts/escalation/readEscalation.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { registerResolveEscalationTool } from '#tools/main/resolve-escalation.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

const openEscalation = async () => {
  const workflow = await createApprovedWorkflow();
  await prepareBuilderRun({ paths: workflow.paths, specId: SPEC_ID });

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

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('resolve escalation tool', () => {
  it('registers a closed owner decision input schema', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerResolveEscalationTool,
    });

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

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveEscalationTool,
    });

    const result = await tool.execute('test-call', {
      specId: SPEC_ID,
      escalationId: opened.escalation.id,
      selectedOptionId: 'option-a',
      decision: 'Use option A.',
      reason: 'It matches the approved contract.',
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(WORKFLOW_PHASES.READY_FOR_BUILDER),
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

    await expect(getHeadCommit(repository.path)).resolves.toBe(
      details.checkpointCommit,
    );
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

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerResolveEscalationTool,
    });

    await expect(
      tool.execute('test-call', {
        specId: SPEC_ID,
        escalationId: 'E2',
        selectedOptionId: 'option-a',
        decision: 'Use option A.',
        reason: 'It matches the approved contract.',
      }),
    ).rejects.toThrow(`expected "${opened.escalation.id}"`);

    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
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
