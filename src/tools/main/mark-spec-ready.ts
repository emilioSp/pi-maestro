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
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

export const MARK_SPEC_READY_TOOL = {
  NAME: 'maestro_mark_spec_ready',
  LABEL: 'Mark Spec Ready',
  DESCRIPTION:
    'Approve proposal.md and spec.md together with design.md if present, only from drafting-spec after the owner replies GREEN FLAG. Freeze all present documents and move to the configured next phase. Only the owner reply GREEN FLAG authorizes approval. Run the builder only if the returned phase is ready-for-builder; otherwise summarize the approved spec and skipped agents.',
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
      const { paths, config } = await resolveToolRunContext(context.cwd);

      const state = await markSpecReady({
        config,
        paths,
        specId,
        activeWorkflowSpecId: maestroSessionState.getActiveSpecId(),
      });

      return {
        content: [
          {
            type: 'text',
            text:
              state.phase === WORKFLOW_PHASES.CANDIDATE_READY
                ? `Spec ${state.specId} is approved. The workflow is candidate-ready. Builder, verifier, and simplifier skipped by configuration. No implementation or verification was performed.`
                : `Spec ${state.specId} is approved and ready-for-builder. Call maestro_run_builder now. No separate owner start request is needed.`,
          },
        ],
        details: state,
      };
    },
  });
};
