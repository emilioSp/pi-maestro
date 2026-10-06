/**
 * Objective: Register the verifier handoff tool for the current checkout.
 * Used: When the verifier reports its terminal review result.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { BuilderAcceptanceCriterionSchema } from '#artifacts/builder-handoff/schema.ts';
import {
  VERIFIER_HANDOFF_VERSION,
  VerifierFindingSchema,
} from '#artifacts/verifier-handoff/schema.ts';
import { createWorkflowCheckpointCommit } from '#git/commits/createWorkflowCheckpointCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { resolveWorkflowContext } from '#tools/child/utils/resolveWorkflowContext.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';

export const VERIFIER_HANDOFF_TOOL = {
  NAME: 'maestro_record_verifier_handoff',
  LABEL: 'Record Verifier Handoff',
  DESCRIPTION:
    'Record the verifier review after restoring every product change. The tool commits only workflow.json and handoffs/verifier.json. Do not run git commit.',
} as const;

const VerifierFindingSubmissionSchema = Type.Object(
  {
    ...VerifierFindingSchema.properties,
    rejection: Type.Null(),
  },
  { additionalProperties: false },
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

      const { paths, repositoryRoot } = await resolveWorkflowContext({
        cwd: context.cwd,
        specId,
      });

      const currentState = await readWorkflowState(
        paths.getWorkflowPath(specId),
      );

      const handoff = {
        version: VERIFIER_HANDOFF_VERSION,
        specId: currentState.specId,
        revision: currentState.revision + 1,
        ...submission,
      };

      const completed = await completeVerifierPass({
        paths,
        specId,
        handoff,
      });

      const workflowCheckpointCommit = await createWorkflowCheckpointCommit({
        repositoryRoot,
        expectedPaths: [
          paths.getWorkflowPath(specId),
          paths.getVerifierHandoffPath(specId),
        ],
      });

      if (!(await getRepositoryStatus(repositoryRoot)).clean) {
        throw new Error(
          'Verifier handoff requires a clean checkout after its commit.',
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: `Verifier handoff recorded as ${completed.state.phase}. The tool committed only the verifier handoff and workflow state. Do not run git commit.`,
          },
        ],
        details: {
          phase: completed.state.phase,
          workflowCheckpointCommit,
          revision: completed.state.revision,
          specId: completed.handoff.specId,
        },
      };
    },
  });
};
