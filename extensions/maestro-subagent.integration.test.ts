import { fileURLToPath } from 'node:url';
import { wrapRegisteredTool } from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it } from 'vitest';
import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { BUILDER_ESCALATION_TOOL } from '#tools/child/open-escalation.ts';
import { BUILDER_HANDOFF_TOOL } from '#tools/child/record-builder-handoff.ts';
import { VERIFIER_HANDOFF_TOOL } from '#tools/child/record-verifier-handoff.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('subagent extension', () => {
  it('given child extensions loaded from disk when builder and verifier submit handoffs then no parent session state is required', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });
    maestroSessionState.deactivate();

    const builder = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
      additionalExtensionPaths: [
        fileURLToPath(import.meta.resolve('#extensions/maestro-subagent.ts')),
      ],
    });

    const builderTools =
      builder.session.extensionRunner.getAllRegisteredTools();

    expect(builderTools.map(({ definition }) => definition.name)).toEqual([
      BUILDER_ESCALATION_TOOL.NAME,
      BUILDER_HANDOFF_TOOL.NAME,
      VERIFIER_HANDOFF_TOOL.NAME,
    ]);

    const builderTool = wrapRegisteredTool(
      builderTools[1],
      builder.session.extensionRunner,
    );

    const builderResult = await builderTool.execute('builder-handoff', {
      specId: SPEC_ID,
      status: BUILDER_HANDOFF_STATUSES.DONE,
      summary: 'Implemented the approved change.',
      acceptanceCriteria: [],
      notes: [],
    });

    expect(builderResult.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    });
    await expect(
      readBuilderHandoff({
        path: paths.getBuilderHandoffPath({
          specId: SPEC_ID,
          handoffPassNumber: 1,
        }),
        specId: SPEC_ID,
      }),
    ).resolves.toMatchObject({ status: BUILDER_HANDOFF_STATUSES.DONE });

    await prepareVerifierRun({ paths, specId: SPEC_ID });

    const verifier = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
      additionalExtensionPaths: [
        fileURLToPath(import.meta.resolve('#extensions/maestro-subagent.ts')),
      ],
    });

    const verifierTools =
      verifier.session.extensionRunner.getAllRegisteredTools();

    const verifierTool = wrapRegisteredTool(
      verifierTools[2],
      verifier.session.extensionRunner,
    );

    const verifierResult = await verifierTool.execute('verifier-handoff', {
      specId: SPEC_ID,
      summary: 'The candidate satisfies the approved specification.',
      acceptanceCriteria: [],
      findings: [],
      notes: [],
    });

    expect(verifierResult.details).toMatchObject({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
    await expect(
      readVerifierHandoff({
        path: paths.getVerifierHandoffPath({
          specId: SPEC_ID,
          handoffPassNumber: 1,
        }),
        specId: SPEC_ID,
      }),
    ).resolves.toMatchObject({ findings: [] });
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
  });
});
