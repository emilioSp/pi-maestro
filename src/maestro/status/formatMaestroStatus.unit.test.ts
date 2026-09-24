import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMaestroInstructions } from '#maestro/instructions/buildMaestroInstructions.ts';
import { createMaestroSessionState } from '#maestro/session/createMaestroSessionState.ts';
import { formatMaestroStatus } from '#maestro/status/formatMaestroStatus.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { pathExists } from '#utils/path-exists.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowPhase,
  type WorkflowState,
} from '#workflow/state/schema.ts';

const SPEC_ID = '20250101-000000-status-test';

const PHASE_LABEL_CASES: Array<{ phase: WorkflowPhase; label: string }> = [
  { phase: WORKFLOW_PHASES.DRAFTING_SPEC, label: 'Preparing specification' },
  { phase: WORKFLOW_PHASES.READY_FOR_BUILDER, label: 'Ready for builder' },
  { phase: WORKFLOW_PHASES.BUILDER_RUNNING, label: 'Builder running' },
  {
    phase: WORKFLOW_PHASES.ESCALATION_DECISION,
    label: 'Owner decision needed: escalation',
  },
  { phase: WORKFLOW_PHASES.BUILDER_FAILED, label: 'Builder failed' },
  { phase: WORKFLOW_PHASES.READY_FOR_VERIFIER, label: 'Ready for verifier' },
  { phase: WORKFLOW_PHASES.VERIFIER_RUNNING, label: 'Verifier running' },
  {
    phase: WORKFLOW_PHASES.FINDINGS_DECISION,
    label: 'Owner decision needed: findings',
  },
  {
    phase: WORKFLOW_PHASES.CANDIDATE_READY,
    label: 'Candidate ready for final review',
  },
  { phase: WORKFLOW_PHASES.FINAL_REVIEW, label: 'Completed' },
];

const createWorkflow = ({
  phase,
  issues = [],
  interrupted = false,
}: {
  phase: WorkflowPhase;
  issues?: readonly string[];
  interrupted?: boolean;
}) => {
  const state: WorkflowState = {
    version: WORKFLOW_STATE_VERSION,
    specId: SPEC_ID,
    revision: 1,
    phase,
    baseBranch: 'main',
  };

  return { state, issues, interrupted };
};

describe('Maestro status', () => {
  it('hides status when Maestro is inactive', () => {
    expect(
      formatMaestroStatus({ active: false, workflow: null }),
    ).toBeUndefined();
  });

  it('shows active mode when there is no workflow', () => {
    expect(formatMaestroStatus({ active: true, workflow: null })).toBe(
      'Maestro active · No active spec',
    );
  });

  it.each(PHASE_LABEL_CASES)(
    'shows the $label label for $phase',
    ({ phase, label }) => {
      const status = formatMaestroStatus({
        active: true,
        workflow: createWorkflow({ phase }),
      });

      expect(status).toBe(`Maestro active · ${SPEC_ID} · ${label}`);
    },
  );

  it('shows every reconciliation issue and an interrupted pass as blocking state', () => {
    const status = formatMaestroStatus({
      active: true,
      workflow: createWorkflow({
        phase: WORKFLOW_PHASES.BUILDER_RUNNING,
        issues: ['Builder worktree is missing.', 'Branch does not match.'],
        interrupted: true,
      }),
    });

    expect(status).toBe(
      `Maestro active · ${SPEC_ID} · Builder running · Interrupted · Blocked: Builder worktree is missing.; Branch does not match.`,
    );
  });

  it('does not show a completed final-review workflow as active work', () => {
    const status = formatMaestroStatus({
      active: true,
      workflow: createWorkflow({ phase: WORKFLOW_PHASES.FINAL_REVIEW }),
    });

    expect(status).toContain('Completed');
  });
});
