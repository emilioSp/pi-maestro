/**
 * Objective: Register owner approval for the current Maestro specification.
 * Used: When the owner approves the initial spec or an authorized revision.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';

export const MARK_SPEC_READY_TOOL = {
  NAME: 'maestro_mark_spec_ready',
  LABEL: 'Mark Spec Ready',
  DESCRIPTION:
    'Approve the current spec.md after the owner replies GREEN FLAG and move the workflow to ready-for-builder. Only the owner reply GREEN FLAG authorizes approval. After this transition succeeds, call maestro_run_builder in the foreground.',
} as const;

const MarkSpecReadyToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
  },
  { additionalProperties: false },
);

export const registerMarkSpecReadyTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: MARK_SPEC_READY_TOOL.NAME,
    label: MARK_SPEC_READY_TOOL.LABEL,
    description: MARK_SPEC_READY_TOOL.DESCRIPTION,
    parameters: MarkSpecReadyToolParameters,
    async execute(_toolCallId, { specId }, _signal, _onUpdate, context) {
      const { paths } = await resolveToolRunContext(context.cwd);

      const state = await markSpecReady({
        paths,
        specId,
        activeWorkflowSpecId: maestroSessionState.getActiveSpecId(),
      });

      return {
        content: [
          {
            type: 'text',
            text: `Spec ${state.specId} is approved and ready-for-builder. Call maestro_run_builder now. No separate owner start request is needed.`,
          },
        ],
        details: state,
      };
    },
  });
};
