/**
 * Objective: Register the simplifier's fixed result recording tool.
 * Used: When a child simplifier completes its refactoring pass.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type Static, Type } from 'typebox';
import { Value } from 'typebox/value';
import {
  SIMPLIFIER_HANDOFF_VERSION,
  SimplifierSubmissionFields,
} from '#artifacts/simplifier-handoff/schema.ts';
import { resolveWorkflowContext } from '#tools/child/utils/resolveWorkflowContext.ts';
import { completeSimplifierPass } from '#workflow/simplifier/completeSimplifierPass.ts';

export const SIMPLIFIER_HANDOFF_TOOL = {
  NAME: 'maestro_record_simplifier_handoff',
  LABEL: 'Record Simplifier Handoff',
  DESCRIPTION:
    'Save the simplifier result at handoffs/simplifier/S.json and complete the workflow. Stop after success.',
} as const;

const SimplifierHandoffToolParameters = Type.Object(
  SimplifierSubmissionFields,
  { additionalProperties: false },
);

function assertSimplifierSubmission(
  input: unknown,
): asserts input is Static<typeof SimplifierHandoffToolParameters> {
  const [error] = Value.Errors(SimplifierHandoffToolParameters, input);

  if (error !== undefined) {
    throw new Error(`Invalid simplifier submission: ${error.message}.`);
  }
}

export const registerRecordSimplifierHandoffTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: SIMPLIFIER_HANDOFF_TOOL.NAME,
    label: SIMPLIFIER_HANDOFF_TOOL.LABEL,
    description: SIMPLIFIER_HANDOFF_TOOL.DESCRIPTION,
    parameters: SimplifierHandoffToolParameters,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      assertSimplifierSubmission(params);

      const { paths } = await resolveWorkflowContext({
        cwd: context.cwd,
        specId: params.specId,
      });

      const completed = await completeSimplifierPass({
        paths,
        specId: params.specId,
        handoff: { ...params, version: SIMPLIFIER_HANDOFF_VERSION },
      });

      return {
        content: [
          {
            type: 'text',
            text: 'Simplifier handoff and candidate-ready phase saved. Stop now.',
          },
        ],
        details: {
          specId: params.specId,
          handoffPath: completed.handoffPath,
          phase: completed.state.phase,
        },
      };
    },
  });
};
