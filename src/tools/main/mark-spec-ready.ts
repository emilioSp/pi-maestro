/**
 * Objective: Register owner approval for the current Maestro specification.
 * Used: When the owner approves the initial spec or an authorized revision.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { resolveToolLaunchContext } from '#tools/utils/resolveToolLaunchContext.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';

export const MARK_SPEC_READY_TOOL = {
  NAME: 'maestro_mark_spec_ready',
  LABEL: 'Mark Spec Ready',
  DESCRIPTION:
    'Approve the current spec.md after explicit owner approval and move the workflow to ready-for-builder. The owner must commit spec.md and workflow.json before launching the builder.',
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
      const { paths } = await resolveToolLaunchContext(context.cwd);

      const state = await markSpecReady({
        paths,
        specId,
        activeWorkflowSpecId: maestroSessionState.getActiveSpecId(),
      });

      return {
        content: [
          {
            type: 'text',
            text: `Spec ${state.specId} is approved at workflow revision ${state.revision} and ready-for-builder. Commit spec.md and workflow.json before launching the builder.`,
          },
        ],
        details: state,
      };
    },
  });
};
