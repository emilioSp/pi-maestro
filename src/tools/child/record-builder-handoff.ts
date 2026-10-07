/**
 * Objective: Register the builder handoff tool for the current project.
 * Used: When the builder reports a done or failed result.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  BUILDER_HANDOFF_STATUSES,
  BuilderAcceptanceCriterionSchema,
  BuilderHandoffFailureSchema,
} from '#artifacts/builder-handoff/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { resolveWorkflowContext } from '#tools/child/utils/resolveWorkflowContext.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';

export const BUILDER_HANDOFF_TOOL = {
  NAME: 'maestro_record_builder_handoff',
  LABEL: 'Record Builder Handoff',
  DESCRIPTION:
    'Record the builder pass as done or failed. Put significant discoveries that do not require an owner decision in notes. After success, stop. The tool saves a numbered builder handoff and the workflow phase.',
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

export const registerRecordBuilderHandoffTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: BUILDER_HANDOFF_TOOL.NAME,
    label: BUILDER_HANDOFF_TOOL.LABEL,
    description: BUILDER_HANDOFF_TOOL.DESCRIPTION,
    parameters: BuilderHandoffToolParameters,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      const { specId, ...handoff } = params;

      const { paths } = await resolveWorkflowContext({
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
            text: `Builder handoff recorded as ${completed.handoff.status}. The handoff and workflow phase are saved. Stop now.`,
          },
        ],
        details: {
          specId: completed.handoff.specId,
          handoffPath: completed.handoffPath,
          phase: completed.state.phase,
        },
      };
    },
  });
};
