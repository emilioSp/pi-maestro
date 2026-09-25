/**
 * Objective: Register the builder handoff tool for the current checkout.
 * Used: When the builder reports a done or failed result.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type Static, Type } from 'typebox';
import {
  BUILDER_HANDOFF_STATUSES,
  BuilderAcceptanceCriterionSchema,
  BuilderHandoffFailureSchema,
} from '#artifacts/builder-handoff/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { getBuilderContext } from '#tools/child/utils/getBuilderContext.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';

export const BUILDER_HANDOFF_TOOL = {
  NAME: 'maestro_record_builder_handoff',
  LABEL: 'Record Builder Handoff',
  DESCRIPTION:
    'Record the builder pass as done or failed. After success, commit the implementation, handoff, and workflow state together with Bash and Git.',
} as const;

const BuilderHandoffContentFields = {
  summary: Type.String({ minLength: 1 }),
  acceptanceCriteria: Type.Array(BuilderAcceptanceCriterionSchema),
  notes: Type.Array(Type.String()),
};

const BuilderHandoffToolParameters = Type.Union([
  Type.Object(
    {
      specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
      status: Type.Literal(BUILDER_HANDOFF_STATUSES.DONE),
      ...BuilderHandoffContentFields,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
      status: Type.Literal(BUILDER_HANDOFF_STATUSES.FAILED),
      ...BuilderHandoffContentFields,
      failure: BuilderHandoffFailureSchema,
    },
    { additionalProperties: false },
  ),
]);

type BuilderHandoffToolParameters = Static<typeof BuilderHandoffToolParameters>;

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
    parameters: BuilderHandoffToolParameters,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      const { specId, ...handoff } = params as BuilderHandoffToolParameters;
      const { paths } = await getBuilderContext({
        cwd: context.cwd,
        specId,
      });
      const completed = await completeBuilderPass({
        paths,
        specId,
        handoff,
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
