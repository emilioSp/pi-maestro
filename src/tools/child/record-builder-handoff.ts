/**
 * Objective: Register the builder handoff tool for child Pi sessions.
 * Used: When the builder reports a done or failed result.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { BuilderHandoffSubmissionSchema } from '#artifacts/builder-handoff/schema.ts';
import { getBuilderWorktreeContext } from '#tools/child/utils/getBuilderWorktreeContext.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';

export const BUILDER_HANDOFF_TOOL = {
  NAME: 'maestro_record_builder_handoff',
  LABEL: 'Record Builder Handoff',
  DESCRIPTION:
    'Record the builder pass as done or failed. After success, commit the implementation, handoff, and workflow state together with Bash and Git.',
} as const;

type RegisterRecordBuilderHandoffToolInput = {
  pi: ExtensionAPI;
};

export const registerRecordBuilderHandoffTool = ({
  pi,
}: RegisterRecordBuilderHandoffToolInput): void => {
  pi.registerTool({
    name: BUILDER_HANDOFF_TOOL.NAME,
    label: BUILDER_HANDOFF_TOOL.LABEL,
    description: BUILDER_HANDOFF_TOOL.DESCRIPTION,
    parameters: BuilderHandoffSubmissionSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      const { paths, specId } = await getBuilderWorktreeContext({
        cwd: context.cwd,
      });
      const completed = await completeBuilderPass({
        paths,
        specId,
        handoff: params,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Builder handoff recorded as ${completed.handoff.status}. Commit your implementation, workflow state, and builder handoff together with Bash and Git, then stop.`,
          },
        ],
        details: {
          specId: completed.handoff.specId,
          revision: completed.handoff.revision,
          phase: completed.state.phase,
        },
      };
    },
  });
};
