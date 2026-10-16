/**
 * Objective: Check Maestro status text, phase styling, and spec ID shortening.
 * Used: In unit tests for the status formatter.
 */

import type { Theme } from '@earendil-works/pi-coding-agent';
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
  type WorkflowState,
} from '#workflow/state/schema.ts';

const theme: Pick<Theme, 'fg'> = {
  fg: (role, text) => `<${role}>${text}</${role}>`,
};

const SPEC_ID = '20250101-000000-status-test';

describe('Maestro status', () => {
  it('given Maestro is disabled when status text is requested then no status text is returned', () => {
    expect(
      formatMaestroStatus({ active: false, workflow: null, theme }),
    ).toBeUndefined();
  });

  it('given Maestro is active without a workflow when status text is requested then it shows Maestro active and No active spec', () => {
    expect(formatMaestroStatus({ active: true, workflow: null, theme })).toBe(
      '<muted>Maestro active · </muted><accent>No active spec</accent>',
    );
  });

  it.each(Object.values(WORKFLOW_PHASES))(
    'given a workflow in %s when status text is requested then it shows the spec ID and the icon, color, and label for that phase',
    (phase) => {
      const state: WorkflowState = {
        version: WORKFLOW_STATE_VERSION,
        specId: SPEC_ID,
        phase,
      };

      const status = formatMaestroStatus({
        active: true,
        workflow: { state },
        theme,
      });

      const icon = WORKFLOW_PHASE_ICONS[phase];
      const color = WORKFLOW_PHASE_COLORS[phase];
      const label = WORKFLOW_PHASE_LABELS[phase];

      expect(status).toBe(
        `<muted>Maestro active · ${SPEC_ID.slice(0, 26)}... · </muted>${icon} <${color}>${label}</${color}>`,
      );
    },
  );

  it.each([
    {
      scenario: 'an ID much longer than 26 characters',
      specId:
        '20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons',
      display: '20261007-170438-update-mae...',
    },
    {
      scenario: 'a short ID',
      specId: '20250101-000000-fix',
      display: '20250101-000000-fix',
    },
    {
      scenario: 'an ID shorter than 26 characters',
      specId: '20250101-000000-status-fix',
      display: '20250101-000000-status-fix',
    },
    {
      scenario: 'an ID just over 26 characters',
      specId: '20250101-000000-fix-1234567-more',
      display: '20250101-000000-fix-123456...',
    },
  ])(
    'given $scenario when status text is requested then it displays $display without changing the stored spec ID',
    ({ specId, display }) => {
      const state: WorkflowState = {
        version: WORKFLOW_STATE_VERSION,
        specId,
        phase: WORKFLOW_PHASES.BUILDER_RUNNING,
      };

      const workflow = { state };

      expect(formatMaestroStatus({ active: true, workflow, theme })).toBe(
        `<muted>Maestro active · ${display} · </muted>🛠️ <accent>Builder running</accent>`,
      );
      expect(workflow.state.specId).toBe(specId);
    },
  );
});
