/**
 * Objective: Define and apply valid workflow phase transitions.
 * Used: When a workflow event moves Maestro to its next phase.
 */

import {
  assertWorkflowState,
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowEvent,
  type WorkflowPhase,
  type WorkflowState,
} from '#workflow/state/schema.ts';

type WorkflowTransition = {
  from: WorkflowPhase[];
  to: WorkflowPhase;
};

export const WORKFLOW_TRANSITIONS: Record<WorkflowEvent, WorkflowTransition> = {
  [WORKFLOW_EVENTS.MARK_SPEC_READY]: {
    from: [WORKFLOW_PHASES.DRAFTING_SPEC],
    to: WORKFLOW_PHASES.READY_FOR_BUILDER,
  },
  [WORKFLOW_EVENTS.RUN_BUILDER]: {
    from: [WORKFLOW_PHASES.READY_FOR_BUILDER],
    to: WORKFLOW_PHASES.BUILDER_RUNNING,
  },
  [WORKFLOW_EVENTS.BUILDER_OPEN_ESCALATIONS]: {
    from: [WORKFLOW_PHASES.BUILDER_RUNNING],
    to: WORKFLOW_PHASES.ESCALATION_DECISIONS,
  },
  [WORKFLOW_EVENTS.RESOLVE_ESCALATIONS]: {
    from: [WORKFLOW_PHASES.ESCALATION_DECISIONS],
    to: WORKFLOW_PHASES.READY_FOR_BUILDER,
  },
  [WORKFLOW_EVENTS.OWNER_REQUEST_SPEC_REVISION]: {
    from: [
      WORKFLOW_PHASES.ESCALATION_DECISIONS,
      WORKFLOW_PHASES.FINDING_DECISIONS,
    ],
    to: WORKFLOW_PHASES.DRAFTING_SPEC,
  },
  [WORKFLOW_EVENTS.BUILDER_DONE]: {
    from: [WORKFLOW_PHASES.BUILDER_RUNNING],
    to: WORKFLOW_PHASES.READY_FOR_VERIFIER,
  },
  [WORKFLOW_EVENTS.RUN_VERIFIER]: {
    from: [WORKFLOW_PHASES.READY_FOR_VERIFIER],
    to: WORKFLOW_PHASES.VERIFIER_RUNNING,
  },
  [WORKFLOW_EVENTS.VERIFIER_FOUND_FINDINGS]: {
    from: [WORKFLOW_PHASES.VERIFIER_RUNNING],
    to: WORKFLOW_PHASES.FINDING_DECISIONS,
  },
  [WORKFLOW_EVENTS.VERIFIER_DONE]: {
    from: [WORKFLOW_PHASES.VERIFIER_RUNNING],
    to: WORKFLOW_PHASES.CANDIDATE_READY,
  },
  [WORKFLOW_EVENTS.OWNER_REJECT_FINDINGS]: {
    from: [WORKFLOW_PHASES.FINDING_DECISIONS],
    to: WORKFLOW_PHASES.CANDIDATE_READY,
  },
  [WORKFLOW_EVENTS.OWNER_REQUEST_FIXES]: {
    from: [WORKFLOW_PHASES.FINDING_DECISIONS],
    to: WORKFLOW_PHASES.READY_FOR_BUILDER,
  },
};

type TransitionWorkflowInput = {
  state: WorkflowState;
  event: WorkflowEvent;
};

export const transitionWorkflow = ({
  state,
  event,
}: TransitionWorkflowInput): WorkflowState => {
  assertWorkflowState(state);
  const current = state;
  const transition = WORKFLOW_TRANSITIONS[event];

  if (transition === undefined) {
    throw new Error(`Unknown workflow event: "${event}".`);
  }

  if (!transition.from.includes(current.phase)) {
    throw new Error(
      `Workflow event "${event}" is not allowed from phase "${current.phase}".`,
    );
  }

  return {
    version: current.version,
    specId: current.specId,
    phase: transition.to,
  };
};
