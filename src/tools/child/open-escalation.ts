/**
 * Objective: Register the escalation tool for child Pi sessions.
 * Used: When the builder needs an owner decision to continue.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { NewEscalationSchema } from '#artifacts/escalation/schema.ts';
import { getBuilderWorktreeContext } from '#tools/child/utils/getBuilderWorktreeContext.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';

export const BUILDER_ESCALATION_TOOL = {
  NAME: 'maestro_open_escalation',
  LABEL: 'Open Builder Escalation',
  DESCRIPTION:
    'Ask the owner to choose between options. After success, commit the escalation, workflow state, and current work together with Bash and Git, then stop. Do not wait for the owner.',
} as const;

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
    parameters: NewEscalationSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      const { paths, specId } = await getBuilderWorktreeContext({
        cwd: context.cwd,
      });
      const opened = await openBuilderEscalation({
        paths,
        specId,
        escalation: params,
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
