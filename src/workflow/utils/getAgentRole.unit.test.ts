import { describe, expect, it } from 'vitest';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { getAgentRole } from '#workflow/utils/getAgentRole.ts';

describe('getAgentRole', () => {
  it.each([
    [WORKFLOW_PHASES.BUILDER_RUNNING, WORKFLOW_ROLES.BUILDER],
    [WORKFLOW_PHASES.ESCALATION_DECISION, WORKFLOW_ROLES.BUILDER],
    [WORKFLOW_PHASES.BUILDER_FAILED, WORKFLOW_ROLES.BUILDER],
    [WORKFLOW_PHASES.READY_FOR_VERIFIER, WORKFLOW_ROLES.BUILDER],
    [WORKFLOW_PHASES.VERIFIER_RUNNING, WORKFLOW_ROLES.VERIFIER],
    [WORKFLOW_PHASES.FINDINGS_DECISION, WORKFLOW_ROLES.VERIFIER],
    [WORKFLOW_PHASES.CANDIDATE_READY, WORKFLOW_ROLES.VERIFIER],
    [WORKFLOW_PHASES.DRAFTING_SPEC, null],
    [WORKFLOW_PHASES.READY_FOR_BUILDER, null],
    [WORKFLOW_PHASES.FINAL_REVIEW, null],
  ])('returns the role for phase %s', (phase, role) => {
    expect(getAgentRole(phase)).toBe(role);
  });
});
