import {
  validateWorkflowState,
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
  [WORKFLOW_EVENTS.LAUNCH_BUILDER]: {
    from: [WORKFLOW_PHASES.READY_FOR_BUILDER],
    to: WORKFLOW_PHASES.BUILDER_RUNNING,
  },
  [WORKFLOW_EVENTS.RETRY_BUILDER]: {
    from: [WORKFLOW_PHASES.BUILDER_RUNNING, WORKFLOW_PHASES.BUILDER_FAILED],
    to: WORKFLOW_PHASES.BUILDER_RUNNING,
  },
  [WORKFLOW_EVENTS.OPEN_ESCALATION]: {
    from: [WORKFLOW_PHASES.BUILDER_RUNNING],
    to: WORKFLOW_PHASES.ESCALATION_DECISION,
  },
  [WORKFLOW_EVENTS.RESOLVE_ESCALATION]: {
    from: [WORKFLOW_PHASES.ESCALATION_DECISION],
    to: WORKFLOW_PHASES.READY_FOR_BUILDER,
  },
  [WORKFLOW_EVENTS.BUILDER_FAILED]: {
    from: [WORKFLOW_PHASES.BUILDER_RUNNING],
    to: WORKFLOW_PHASES.BUILDER_FAILED,
  },
  [WORKFLOW_EVENTS.BUILDER_DONE]: {
    from: [WORKFLOW_PHASES.BUILDER_RUNNING],
    to: WORKFLOW_PHASES.READY_FOR_VERIFIER,
  },
  [WORKFLOW_EVENTS.LAUNCH_VERIFIER]: {
    from: [WORKFLOW_PHASES.READY_FOR_VERIFIER],
    to: WORKFLOW_PHASES.VERIFIER_RUNNING,
  },
  [WORKFLOW_EVENTS.RETRY_VERIFIER]: {
    from: [WORKFLOW_PHASES.VERIFIER_RUNNING],
    to: WORKFLOW_PHASES.VERIFIER_RUNNING,
  },
  [WORKFLOW_EVENTS.VERIFIER_FOUND_FINDINGS]: {
    from: [WORKFLOW_PHASES.VERIFIER_RUNNING],
    to: WORKFLOW_PHASES.FINDINGS_DECISION,
  },
  [WORKFLOW_EVENTS.VERIFIER_APPROVED]: {
    from: [WORKFLOW_PHASES.VERIFIER_RUNNING],
    to: WORKFLOW_PHASES.CANDIDATE_READY,
  },
  [WORKFLOW_EVENTS.REJECT_FINDINGS]: {
    from: [WORKFLOW_PHASES.FINDINGS_DECISION],
    to: WORKFLOW_PHASES.CANDIDATE_READY,
  },
  [WORKFLOW_EVENTS.REQUEST_FIXES]: {
    from: [WORKFLOW_PHASES.FINDINGS_DECISION],
    to: WORKFLOW_PHASES.READY_FOR_BUILDER,
  },
  [WORKFLOW_EVENTS.PREPARE_FINAL_REVIEW]: {
    from: [WORKFLOW_PHASES.CANDIDATE_READY],
    to: WORKFLOW_PHASES.FINAL_REVIEW,
  },
};

export const transitionWorkflow = ({
  state,
  event,
}: {
  state: WorkflowState;
  event: WorkflowEvent;
}): WorkflowState => {
  const current = validateWorkflowState(state);
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
    ...current,
    revision: current.revision + 1,
    phase: transition.to,
  };
};
