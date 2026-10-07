import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import {
  FINDING_DECISIONS,
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
} from '#artifacts/verifier-handoff/schema.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { resolveFindings } from '#workflow/findings/resolveFindings.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

afterEach(cleanupBuilderWorkflows);

describe('finding resolution', () => {
  it('given mixed owner decisions when the fix cycle completes then earlier handoffs and both decisions survive', async () => {
    const { paths } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    const firstBuilder = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: { ...doneHandoff(), summary: 'Implemented greeting' },
    });

    const builderBefore = await readFile(firstBuilder.handoffPath, 'utf8');
    await prepareVerifierRun({ paths, specId: SPEC_ID });

    const firstVerifier = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        summary: 'Checked greeting',
        acceptanceCriteria: [],
        findings: [
          {
            id: 'F1',
            acceptanceCriterion: null,
            severity: FINDING_SEVERITIES.LOW,
            confidence: 1,
            summary: 'The greeting has no translation.',
            evidence: [
              {
                source: 'hello.txt',
                observation: 'The greeting is only in English.',
              },
            ],
            decision: null,
          },
          {
            id: 'F2',
            acceptanceCriterion: null,
            severity: FINDING_SEVERITIES.MEDIUM,
            confidence: 1,
            summary: 'The greeting has no newline.',
            evidence: [
              {
                source: 'hello.txt',
                observation: 'The final newline is missing.',
              },
            ],
            decision: null,
          },
        ],
        notes: [],
      },
    });

    const resolved = await resolveFindings({
      paths,
      specId: SPEC_ID,
      decisions: [
        {
          findingId: 'F1',
          decision: FINDING_DECISIONS.REJECT,
          reason: 'Outside approved scope',
        },
        { findingId: 'F2', decision: FINDING_DECISIONS.FIX_CODE },
      ],
    });

    expect(resolved.state.phase).toBe(WORKFLOW_PHASES.READY_FOR_BUILDER);

    const verifierAfterDecisions = await readFile(
      firstVerifier.handoffPath,
      'utf8',
    );

    await prepareBuilderRun({ paths, specId: SPEC_ID });

    const secondBuilder = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: { ...doneHandoff(), summary: 'Fixed greeting' },
    });

    await prepareVerifierRun({ paths, specId: SPEC_ID });

    const secondVerifier = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        summary: 'Checked fixed greeting',
        acceptanceCriteria: [],
        findings: [],
        notes: [],
      },
    });

    expect(secondVerifier.state.phase).toBe(WORKFLOW_PHASES.CANDIDATE_READY);
    expect(secondBuilder.handoffPath).toBe(
      paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffPassNumber: 2 }),
    );
    expect(secondVerifier.handoffPath).toBe(
      paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 2 }),
    );
    await expect(readFile(firstBuilder.handoffPath, 'utf8')).resolves.toBe(
      builderBefore,
    );
    await expect(
      readBuilderHandoff({ path: firstBuilder.handoffPath, specId: SPEC_ID }),
    ).resolves.toMatchObject({
      summary: 'Implemented greeting',
      acceptanceCriteria: doneHandoff().acceptanceCriteria,
    });
    await expect(readFile(firstVerifier.handoffPath, 'utf8')).resolves.toBe(
      verifierAfterDecisions,
    );
    await expect(
      readVerifierHandoff({ path: firstVerifier.handoffPath, specId: SPEC_ID }),
    ).resolves.toMatchObject({
      findings: [
        {
          id: 'F1',
          decision: {
            decision: FINDING_DECISIONS.REJECT,
            reason: 'Outside approved scope',
          },
        },
        { id: 'F2', decision: { decision: FINDING_DECISIONS.FIX_CODE } },
      ],
    });
    await expect(paths.getActiveBuilderHandoffPath(SPEC_ID)).resolves.toBe(
      secondBuilder.handoffPath,
    );
    await expect(paths.getActiveVerifierHandoffPath(SPEC_ID)).resolves.toBe(
      secondVerifier.handoffPath,
    );
  });
});
