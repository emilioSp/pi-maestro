/**
 * Objective: Prove the simplifier's closed fixed artifact and validation boundaries.
 * Used: With the registered child tool against isolated workflow files.
 */

import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { registerRecordSimplifierHandoffTool } from '#tools/child/record-simplifier-handoff.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

const createRunningVerifier = async () => {
  const workflow = await createApprovedWorkflow();
  await prepareBuilderRun({ paths: workflow.paths, specId: SPEC_ID });
  await completeBuilderPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: doneHandoff(),
  });
  await prepareVerifierRun({ paths: workflow.paths, specId: SPEC_ID });

  return workflow;
};

const verifiedHandoff = {
  version: '1.0.0',
  specId: SPEC_ID,
  summary: 'Verified',
  acceptanceCriteria: doneHandoff().acceptanceCriteria,
  findings: [],
  notes: [],
};

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('record simplifier handoff', () => {
  it('given a selected file and coordinated caller update when submitted then exactly the agreed S.json is saved before completion', async () => {
    const { paths, repository } = await createRunningVerifier();
    await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      handoff: verifiedHandoff,
    });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRecordSimplifierHandoffTool,
    });

    const submission = {
      specId: SPEC_ID,
      refactoredFiles: ['src/counts.ts', 'src/report.ts'],
      summary: 'Simplified counting',
      notes: ['Updated the caller to read the Map.'],
    };

    const result = await tool.execute('record', submission);
    expect(
      JSON.parse(
        await readFile(paths.getSimplifierHandoffPath(SPEC_ID), 'utf8'),
      ),
    ).toEqual({ version: '1.0.0', ...submission });
    expect(paths.getSimplifierHandoffPath(SPEC_ID)).toBe(
      `${paths.getSpecPath(SPEC_ID)}/handoffs/simplifier/S.json`,
    );
    expect(result.details).toEqual({
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      handoffPath: paths.getSimplifierHandoffPath(SPEC_ID),
    });
    expect(
      await readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
  });
});
