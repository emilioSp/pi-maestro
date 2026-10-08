/**
 * Objective: Register owner resolution of every current builder escalation.
 * Used: When the owner keeps the approved contract and resolves all current questions.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  ESCALATION_ID_PATTERN,
  EscalationResolutionSchema,
} from '#artifacts/builder-handoff/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { resolveEscalations } from '#workflow/escalation/resolveEscalations.ts';

export const RESOLVE_ESCALATIONS_TOOL = {
  NAME: 'maestro_resolve_escalations',
  LABEL: 'Resolve Escalations',
  DESCRIPTION:
    'Record the explicit owner decision for every current builder escalation when the approved contract remains valid. Save the resolution and workflow transition, then return ready-for-builder without running the builder. If the contract must change, edit spec.md and use maestro_mark_spec_ready instead.',
} as const;

const ResolveEscalationsToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
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
      const { specId, decisions } = params;
      const { paths } = await resolveToolRunContext(context.cwd);

      const resolved = await resolveEscalations({
        paths,
        specId,
        decisions,
      });

      return {
        content: [
          {
            type: 'text',
            text: `All current escalations resolved. Spec ${resolved.state.specId} is ready-for-builder. Run the builder separately.`,
          },
        ],
        details: {
          specId: resolved.state.specId,
          handoff: resolved.handoff,
          phase: resolved.state.phase,
          projectRoot: resolved.projectRoot,
        },
      };
    },
  });
};
