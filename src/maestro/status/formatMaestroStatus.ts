/**
 * Objective: Format the active Maestro workflow for Pi status display.
 * Used: When the main extension refreshes Maestro status.
 */

import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';

const WORKFLOW_PHASE_LABELS = {
  [WORKFLOW_PHASES.DRAFTING_SPEC]: 'Preparing specification',
  [WORKFLOW_PHASES.READY_FOR_BUILDER]: 'Ready for builder',
  [WORKFLOW_PHASES.BUILDER_RUNNING]: 'Builder running',
  [WORKFLOW_PHASES.ESCALATION_DECISION]: 'Owner decision needed: escalation',
  [WORKFLOW_PHASES.BUILDER_FAILED]: 'Builder failed',
  [WORKFLOW_PHASES.READY_FOR_VERIFIER]: 'Ready for verifier',
  [WORKFLOW_PHASES.VERIFIER_RUNNING]: 'Verifier running',
  [WORKFLOW_PHASES.FINDINGS_DECISION]: 'Owner decision needed: findings',
  [WORKFLOW_PHASES.CANDIDATE_READY]: 'Candidate ready for final review',
  [WORKFLOW_PHASES.FINAL_REVIEW]: 'Completed',
} as const;

type MaestroStatusWorkflow = {
  state: WorkflowState;
};

type FormatMaestroStatusInput = {
  active: boolean;
  workflow: MaestroStatusWorkflow | null;
};

export const formatMaestroStatus = ({
  active,
  workflow,
}: FormatMaestroStatusInput): string | undefined => {
  if (!active) {
    return undefined;
  }

  if (workflow === null) {
    return 'Maestro active · No active spec';
  }

  const phase = WORKFLOW_PHASE_LABELS[workflow.state.phase];

  return `Maestro active · ${workflow.state.specId} · ${phase}`;
};
