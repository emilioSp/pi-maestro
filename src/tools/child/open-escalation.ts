/**
 * Objective: Register the builder escalation tool for the current checkout.
 * Used: When the builder needs an owner decision to continue.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  EscalationOptionSchema,
  EscalationRecommendationSchema,
} from '#artifacts/escalation/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { getBuilderContext } from '#tools/child/utils/getBuilderContext.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';

export const BUILDER_ESCALATION_TOOL = {
  NAME: 'maestro_open_escalation',
  LABEL: 'Open Builder Escalation',
  DESCRIPTION:
    'Ask the owner to choose between options. After success, commit the escalation, workflow state, and current work together with Bash and Git, then stop. Do not wait for the owner.',
} as const;

const BuilderEscalationToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    question: Type.String({ minLength: 1 }),
    context: Type.String({ minLength: 1 }),
    options: Type.Array(EscalationOptionSchema, { minItems: 1 }),
    recommendation: Type.Union([EscalationRecommendationSchema, Type.Null()]),
    notes: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

type RegisterOpenEscalationToolInput = {
  pi: ExtensionAPI;
};

export const registerOpenEscalationTool = ({
  pi,
}: RegisterOpenEscalationToolInput): void => {
  pi.registerTool({
    name: BUILDER_ESCALATION_TOOL.NAME,
    label: BUILDER_ESCALATION_TOOL.LABEL,
    description: BUILDER_ESCALATION_TOOL.DESCRIPTION,
    parameters: BuilderEscalationToolParameters,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      const { specId, ...escalation } = params;
      const { paths } = await getBuilderContext({
        cwd: context.cwd,
        specId,
      });
      const opened = await openBuilderEscalation({
        paths,
        specId,
        escalation,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Escalation ${opened.escalation.id} recorded. Commit your current work, the escalation, and workflow state together with Bash and Git, then stop. Do not wait for the owner.`,
          },
        ],
        details: {
          specId: opened.escalation.specId,
          escalationId: opened.escalation.id,
          escalationPath: opened.escalationPath,
          revision: opened.escalation.revision,
          phase: opened.state.phase,
        },
      };
    },
  });
};
