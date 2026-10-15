/**
 * Objective: Save all owner resolutions in the active builder handoff.
 * Used: When the owner resolves current questions, with or without spec revision.
 */

import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  type Escalation,
  type EscalationResolution,
} from '#artifacts/builder-handoff/schema.ts';
import { writeBuilderHandoff } from '#artifacts/builder-handoff/writeBuilderHandoff.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { getWorkflowEventBySpecChangeRequired } from '#workflow/builder/utils/getWorkflowEventBySpecChangeRequired.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type EscalationDecision = EscalationResolution & {
  escalationId: string;
};

type ApplyEscalationDecisionsInput = {
  escalations: Escalation[];
  decisions: EscalationDecision[];
};

const applyEscalationDecisions = ({
  escalations,
  decisions,
}: ApplyEscalationDecisionsInput) => {
  if (escalations.some(({ resolution }) => resolution !== null)) {
    throw new Error('Current questions already contain an owner resolution.');
  }

  if (decisions.length === 0)
    throw new Error('At least one escalation decision is required.');

  const expectedIds = new Set(escalations.map(({ id }) => id));
  const resolutions = new Map<string, EscalationResolution>();

  for (const { escalationId, ...resolution } of decisions) {
    if (!expectedIds.has(escalationId))
      throw new Error(`Unknown escalation ID: "${escalationId}".`);

    if (resolutions.has(escalationId))
      throw new Error(`Duplicate decision for escalation "${escalationId}".`);

    resolutions.set(escalationId, resolution);
  }

  return escalations.map((escalation) => {
    const resolution = resolutions.get(escalation.id);

    if (resolution === undefined)
      throw new Error(`Missing decision for escalation "${escalation.id}".`);

    return { ...escalation, resolution };
  });
};

type ResolveEscalationsInput = {
  paths: MaestroPaths;
  specId: string;
  specChangeRequired: boolean;
  decisions: EscalationDecision[];
};

export const resolveEscalations = async ({
  paths,
  specId,
  specChangeRequired,
  decisions,
}: ResolveEscalationsInput) => {
  const workflowPath = paths.getWorkflowPath(specId);
  const state = await readWorkflowState(workflowPath);

  if (state.specId !== specId) throw new Error('Workflow spec ID mismatch.');

  if (state.phase !== WORKFLOW_PHASES.ESCALATION_DECISIONS) {
    throw new Error(
      `Escalation resolution requires escalation-decisions state, found "${state.phase}".`,
    );
  }

  const handoffPath = await paths.getActiveBuilderHandoffPath(specId);
  const handoff = await readBuilderHandoff({ path: handoffPath, specId });

  if (handoff.status !== BUILDER_HANDOFF_STATUSES.ESCALATION) {
    throw new Error('Escalation resolution requires an escalation handoff.');
  }

  const escalations = applyEscalationDecisions({
    escalations: handoff.escalations,
    decisions,
  });

  const nextHandoff = { ...handoff, escalations };

  const nextState = transitionWorkflow({
    state,
    event: getWorkflowEventBySpecChangeRequired(specChangeRequired),
  });

  // The artifact writer validates every resolution before the first protocol write.
  await writeBuilderHandoff({
    path: handoffPath,
    handoff: nextHandoff,
    specId,
  });
  await writeWorkflowState({ path: workflowPath, state: nextState });

  return {
    handoff: nextHandoff,
    state: nextState,
    projectRoot: paths.getProjectRoot(),
  };
};
