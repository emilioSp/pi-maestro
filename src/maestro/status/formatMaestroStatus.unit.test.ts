import type { Theme, ThemeColor } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';
import {
  formatMaestroStatus,
  WORKFLOW_PHASE_COLORS,
  WORKFLOW_PHASE_ICONS,
  WORKFLOW_PHASE_LABELS,
} from '#maestro/status/formatMaestroStatus.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowPhase,
  type WorkflowState,
} from '#workflow/state/schema.ts';

const theme: Pick<Theme, 'fg'> = {
  fg: (role, text) => `<${role}>${text}</${role}>`,
};

const SPEC_ID = '20250101-000000-status-test';

const PHASE_LABEL_CASES: Array<{
  phase: WorkflowPhase;
  label: string;
  icon: string;
  color: ThemeColor;
}> = [
  {
    phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    icon: WORKFLOW_PHASE_ICONS[WORKFLOW_PHASES.DRAFTING_SPEC],
    color: WORKFLOW_PHASE_COLORS[WORKFLOW_PHASES.DRAFTING_SPEC],
    label: WORKFLOW_PHASE_LABELS[WORKFLOW_PHASES.DRAFTING_SPEC],
  },
  {
    phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    icon: WORKFLOW_PHASE_ICONS[WORKFLOW_PHASES.READY_FOR_BUILDER],
    color: WORKFLOW_PHASE_COLORS[WORKFLOW_PHASES.READY_FOR_BUILDER],
    label: WORKFLOW_PHASE_LABELS[WORKFLOW_PHASES.READY_FOR_BUILDER],
  },
  {
    phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    icon: WORKFLOW_PHASE_ICONS[WORKFLOW_PHASES.BUILDER_RUNNING],
    color: WORKFLOW_PHASE_COLORS[WORKFLOW_PHASES.BUILDER_RUNNING],
    label: WORKFLOW_PHASE_LABELS[WORKFLOW_PHASES.BUILDER_RUNNING],
  },
  {
    phase: WORKFLOW_PHASES.ESCALATION_DECISION,
    icon: WORKFLOW_PHASE_ICONS[WORKFLOW_PHASES.ESCALATION_DECISION],
    color: WORKFLOW_PHASE_COLORS[WORKFLOW_PHASES.ESCALATION_DECISION],
    label: WORKFLOW_PHASE_LABELS[WORKFLOW_PHASES.ESCALATION_DECISION],
  },
  {
    phase: WORKFLOW_PHASES.BUILDER_FAILED,
    icon: WORKFLOW_PHASE_ICONS[WORKFLOW_PHASES.BUILDER_FAILED],
    color: WORKFLOW_PHASE_COLORS[WORKFLOW_PHASES.BUILDER_FAILED],
    label: WORKFLOW_PHASE_LABELS[WORKFLOW_PHASES.BUILDER_FAILED],
  },
  {
    phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    icon: WORKFLOW_PHASE_ICONS[WORKFLOW_PHASES.READY_FOR_VERIFIER],
    color: WORKFLOW_PHASE_COLORS[WORKFLOW_PHASES.READY_FOR_VERIFIER],
    label: WORKFLOW_PHASE_LABELS[WORKFLOW_PHASES.READY_FOR_VERIFIER],
  },
  {
    phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    icon: WORKFLOW_PHASE_ICONS[WORKFLOW_PHASES.VERIFIER_RUNNING],
    color: WORKFLOW_PHASE_COLORS[WORKFLOW_PHASES.VERIFIER_RUNNING],
    label: WORKFLOW_PHASE_LABELS[WORKFLOW_PHASES.VERIFIER_RUNNING],
  },
  {
    phase: WORKFLOW_PHASES.FINDINGS_DECISION,
    icon: WORKFLOW_PHASE_ICONS[WORKFLOW_PHASES.FINDINGS_DECISION],
    color: WORKFLOW_PHASE_COLORS[WORKFLOW_PHASES.FINDINGS_DECISION],
    label: WORKFLOW_PHASE_LABELS[WORKFLOW_PHASES.FINDINGS_DECISION],
  },
  {
    phase: WORKFLOW_PHASES.CANDIDATE_READY,
    icon: WORKFLOW_PHASE_ICONS[WORKFLOW_PHASES.CANDIDATE_READY],
    color: WORKFLOW_PHASE_COLORS[WORKFLOW_PHASES.CANDIDATE_READY],
    label: WORKFLOW_PHASE_LABELS[WORKFLOW_PHASES.CANDIDATE_READY],
  },
];

const createWorkflow = (phase: WorkflowPhase) => {
  const state: WorkflowState = {
    version: WORKFLOW_STATE_VERSION,
    specId: SPEC_ID,
    phase,
  };

  return { state };
};

describe('Maestro status', () => {
  it('given inactive Maestro when status is formatted then status is hidden', () => {
    expect(
      formatMaestroStatus({ active: false, workflow: null, theme }),
    ).toBeUndefined();
  });

  it('given active Maestro without a workflow when status is formatted then active mode is shown', () => {
    expect(formatMaestroStatus({ active: true, workflow: null, theme })).toBe(
      '<muted>Maestro active · </muted><accent>No active spec</accent>',
    );
  });

  it.each(PHASE_LABEL_CASES)(
    'given the $phase phase when status is formatted then the $label label is shown',
    ({ phase, label, icon, color }) => {
      const status = formatMaestroStatus({
        active: true,
        workflow: createWorkflow(phase),
        theme,
      });

      expect(status).toBe(
        `<muted>Maestro active · ${SPEC_ID.slice(0, 26)}... · </muted>${icon} <${color}>${label}</${color}>`,
      );
    },
  );

  it.each([
    {
      specId:
        '20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons',
      display: '20261007-170438-update-mae...',
    },
    { specId: '20250101-000000-fix', display: '20250101-000000-fix' },
    {
      specId: '20250101-000000-status-fix',
      display: '20250101-000000-status-fix',
    },
    {
      specId: '20250101-000000-fix-1234567-more',
      display: '20250101-000000-fix-123456...',
    },
  ])(
    'given $specId when formatted then only the display becomes $display',
    ({ specId, display }) => {
      const workflow = createWorkflow(WORKFLOW_PHASES.BUILDER_RUNNING);
      workflow.state.specId = specId;

      expect(formatMaestroStatus({ active: true, workflow, theme })).toBe(
        `<muted>Maestro active · ${display} · </muted>🛠️ <accent>Builder running</accent>`,
      );
      expect(workflow.state.specId).toBe(specId);
    },
  );
});
