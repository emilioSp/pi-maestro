/**
 * Objective: Register the verifier handoff tool for the current project.
 * Used: When the verifier reports its terminal review result.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { BuilderAcceptanceCriterionSchema } from '#artifacts/builder-handoff/schema.ts';
import {
  VERIFIER_HANDOFF_VERSION,
  VerifierFindingSchema,
} from '#artifacts/verifier-handoff/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { resolveWorkflowContext } from '#tools/child/utils/resolveWorkflowContext.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';

export const VERIFIER_HANDOFF_TOOL = {
  NAME: 'maestro_record_verifier_handoff',
  LABEL: 'Record Verifier Handoff',
  DESCRIPTION:
    'Record the verifier review after restoring only temporary changes from this pass. The tool saves a numbered verifier handoff and the workflow phase.',
} as const;

const VerifierFindingSubmissionSchema = Type.Object(
  {
    ...VerifierFindingSchema.properties,
    decision: Type.Null(),
  },
  {
    additionalProperties: false,
  },
);

const VerifierHandoffToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    summary: Type.String({ minLength: 1 }),
    acceptanceCriteria: Type.Array(BuilderAcceptanceCriterionSchema),
    findings: Type.Array(VerifierFindingSubmissionSchema),
    notes: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export const registerRecordVerifierHandoffTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: VERIFIER_HANDOFF_TOOL.NAME,
    label: VERIFIER_HANDOFF_TOOL.LABEL,
    description: VERIFIER_HANDOFF_TOOL.DESCRIPTION,
    parameters: VerifierHandoffToolParameters,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      const { specId, ...submission } = params;

      const { paths } = await resolveWorkflowContext({
        cwd: context.cwd,
        specId,
      });

      const currentState = await readWorkflowState(
        paths.getWorkflowPath(specId),
      );

      const handoff = {
        version: VERIFIER_HANDOFF_VERSION,
        specId: currentState.specId,
        summary: submission.summary,
        acceptanceCriteria: submission.acceptanceCriteria,
        findings: submission.findings,
        notes: submission.notes,
      };

      const completed = await completeVerifierPass({
        paths,
        specId,
        handoff,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Verifier handoff recorded as ${completed.state.phase}. The handoff and workflow phase are saved. Stop now.`,
          },
        ],
        details: {
          handoffPath: completed.handoffPath,
          phase: completed.state.phase,
          specId: completed.handoff.specId,
        },
      };
    },
  });
};
