/**
 * Objective: Register owner resolution of every current builder escalation.
 * Used: When the owner resolves all current questions, including spec revision decisions.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  ESCALATION_ID_PATTERN,
  EscalationResolutionSchema,
} from '#artifacts/builder-handoff/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { resolveEscalations } from '#workflow/builder/resolveEscalations.ts';

export const RESOLVE_ESCALATIONS_TOOL = {
  NAME: 'maestro_resolve_escalations',
  LABEL: 'Resolve Escalations',
  DESCRIPTION:
    'Record the complete owner decision batch in the active builder handoff before changing phase. Set specChangeRequired to false for ready-for-builder, or true for drafting-spec when any answer requires revision. For each revision answer, identify escalationId and describe the agreed spec change in decision. In drafting-spec, revise the same spec and obtain renewed GREEN FLAG before a separate maestro_mark_spec_ready call. This tool neither approves a spec nor runs an agent.',
} as const;

const ResolveEscalationsToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    specChangeRequired: Type.Boolean(),
    decisions: Type.Array(
      Type.Object(
        {
          escalationId: Type.String({ pattern: ESCALATION_ID_PATTERN.source }),
          ...EscalationResolutionSchema.properties,
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
  },
  { additionalProperties: false },
);

export const registerResolveEscalationsTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: RESOLVE_ESCALATIONS_TOOL.NAME,
    label: RESOLVE_ESCALATIONS_TOOL.LABEL,
    description: RESOLVE_ESCALATIONS_TOOL.DESCRIPTION,
    parameters: ResolveEscalationsToolParameters,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      const { specId, specChangeRequired, decisions } = params;
      const { paths } = await resolveToolRunContext(context.cwd);

      const resolved = await resolveEscalations({
        paths,
        specId,
        specChangeRequired,
        decisions,
      });

      const nextAction = specChangeRequired
        ? 'Revise the same spec with the owner and obtain renewed GREEN FLAG. Then call maestro_mark_spec_ready separately before running the builder.'
        : 'Run the builder separately. No renewed approval is required.';

      return {
        content: [
          {
            type: 'text',
            text: `All current escalations resolved. Spec ${resolved.state.specId} is ${resolved.state.phase}. ${nextAction}`,
          },
        ],
        details: {
          specId: resolved.state.specId,
          handoff: resolved.handoff,
          phase: resolved.state.phase,
          nextAction,
          projectRoot: resolved.projectRoot,
        },
      };
    },
  });
};
