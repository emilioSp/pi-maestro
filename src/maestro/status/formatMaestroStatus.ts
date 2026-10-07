/**
 * Objective: Format the active Maestro workflow for Pi status display.
 * Used: When the main extension refreshes Maestro status.
 */

import type { Theme, ThemeColor } from '@earendil-works/pi-coding-agent';
import {
  WORKFLOW_PHASES,
  type WorkflowPhase,
  type WorkflowState,
} from '#workflow/state/schema.ts';

export const WORKFLOW_PHASE_LABELS = {
  [WORKFLOW_PHASES.DRAFTING_SPEC]: 'Preparing specification',
  [WORKFLOW_PHASES.READY_FOR_BUILDER]: 'Ready for builder',
  [WORKFLOW_PHASES.BUILDER_RUNNING]: 'Builder running',
  [WORKFLOW_PHASES.ESCALATION_DECISION]: 'Owner decision needed: escalation',
  [WORKFLOW_PHASES.BUILDER_FAILED]: 'Builder failed',
  [WORKFLOW_PHASES.READY_FOR_VERIFIER]: 'Ready for verifier',
  [WORKFLOW_PHASES.VERIFIER_RUNNING]: 'Verifier running',
  [WORKFLOW_PHASES.FINDINGS_DECISION]: 'Owner decision needed: findings',
  [WORKFLOW_PHASES.CANDIDATE_READY]: 'Completed',
} as const;

export const WORKFLOW_PHASE_ICONS = {
  [WORKFLOW_PHASES.DRAFTING_SPEC]: '📝',
  [WORKFLOW_PHASES.READY_FOR_BUILDER]: '🚧',
  [WORKFLOW_PHASES.BUILDER_RUNNING]: '🛠️',
  [WORKFLOW_PHASES.ESCALATION_DECISION]: '✋',
  [WORKFLOW_PHASES.BUILDER_FAILED]: '❌',
  [WORKFLOW_PHASES.READY_FOR_VERIFIER]: '📋',
  [WORKFLOW_PHASES.VERIFIER_RUNNING]: '🔍',
  [WORKFLOW_PHASES.FINDINGS_DECISION]: '💬',
  [WORKFLOW_PHASES.CANDIDATE_READY]: '✅',
} as const;

const getPhaseColor = (phase: WorkflowPhase): ThemeColor => {
  if (
    phase === WORKFLOW_PHASES.ESCALATION_DECISION ||
    phase === WORKFLOW_PHASES.FINDINGS_DECISION
  ) {
    return 'warning';
  }

  if (phase === WORKFLOW_PHASES.BUILDER_FAILED) {
    return 'error';
  }

  if (phase === WORKFLOW_PHASES.CANDIDATE_READY) {
    return 'success';
  }

  return 'accent';
};

const shortenSpecId = (specId: string): string => {
  const title = specId.slice(16);

  if (title.length <= 10) {
    return specId;
  }

  return `${specId.slice(0, 26)}...`;
};

type MaestroStatusWorkflow = {
  state: WorkflowState;
};

type FormatMaestroStatusInput = {
  active: boolean;
  workflow: MaestroStatusWorkflow | null;
  theme: Pick<Theme, 'fg'>; // foreground theme
};

export const formatMaestroStatus = ({
  active,
  workflow,
  theme,
}: FormatMaestroStatusInput): string | undefined => {
  if (!active) {
    return undefined;
  }

  if (workflow === null) {
    // muted is a theme color for less prominent text, usually a dim gray.
    return `${theme.fg('muted', 'Maestro active · ')}${theme.fg('accent', 'No active spec')}`;
  }

  const { phase, specId } = workflow.state;

  const prefix = theme.fg(
    'muted',
    `Maestro active · ${shortenSpecId(specId)} · `,
  );

  const label = theme.fg(getPhaseColor(phase), WORKFLOW_PHASE_LABELS[phase]);

  return `${prefix}${WORKFLOW_PHASE_ICONS[phase]} ${label}`;
};
