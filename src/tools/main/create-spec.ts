/**
 * Objective: Register spec creation for the owner Pi session.
 * Used: When Maestro starts a new owner workflow.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { createSpec } from '#specs/create.ts';
import { resolveToolLaunchContext } from '#tools/utils/resolveToolLaunchContext.ts';

export const CREATE_SPEC_TOOL = {
  NAME: 'maestro_create_spec',
  LABEL: 'Create Spec',
  DESCRIPTION:
    'Create a new Maestro specification in drafting-spec phase from the approved template. Review the generated spec with the owner before marking it ready.',
} as const;

const CreateSpecToolParameters = Type.Object(
  {
    title: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const registerCreateSpecTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: CREATE_SPEC_TOOL.NAME,
    label: CREATE_SPEC_TOOL.LABEL,
    description: CREATE_SPEC_TOOL.DESCRIPTION,
    parameters: CreateSpecToolParameters,
    async execute(_toolCallId, { title }, _signal, _onUpdate, context) {
      const { paths } = await resolveToolLaunchContext(context.cwd);

      const created = await createSpec({
        paths,
        title,
        activeWorkflowSpecId: maestroSessionState.getActiveSpecId(),
      });

      maestroSessionState.setActiveSpecId(created.specId);

      return {
        content: [
          {
            type: 'text',
            text: `Spec ${created.specId} created in drafting-spec phase. Review ${created.specFilePath} with the owner before marking it ready.`,
          },
        ],
        details: created,
      };
    },
  });
};
