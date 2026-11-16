/**
 * Objective: Register the fixed Jev workflow scoring operation for Maestro.
 * Used: After implementation phases finish and before the final summary.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { scoreWorkflow } from '#src/score/scoreWorkflow.ts';

export const SCORE_WORKFLOW_TOOL = {
  NAME: 'maestro_score_workflow',
  LABEL: 'Score Workflow',
  DESCRIPTION:
    'Evaluate the active implementation in scorer-running with the fixed Jev classifier. Collect evidence, save scores or a failure, then reach candidate-ready. Call next without owner approval.',
} as const;

export const registerScoreWorkflowTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: SCORE_WORKFLOW_TOOL.NAME,
    label: SCORE_WORKFLOW_TOOL.LABEL,
    description: SCORE_WORKFLOW_TOOL.DESCRIPTION,
    executionMode: 'sequential',
    parameters: Type.Object(
      { specId: Type.String({ pattern: SPEC_ID_PATTERN.source }) },
      { additionalProperties: false },
    ),
    async execute(_toolCallId, { specId }, signal, _onUpdate, context) {
      const details = await scoreWorkflow({ pi, context, specId, signal });

      return {
        content: [
          {
            type: 'text',
            text: `Workflow evaluation saved. Report this saved outcome, its paths, and separate scores and confidences if successful; a judge score is not proof of correctness.\n${JSON.stringify(details)}`,
          },
        ],
        details,
      };
    },
  });
};
