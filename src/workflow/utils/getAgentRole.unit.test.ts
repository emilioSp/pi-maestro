import { describe, expect, it } from 'vitest';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { getAgentRole } from '#workflow/utils/getAgentRole.ts';

describe('getAgentRole', () => {
  it.each([
    [WORKFLOW_PHASES.BUILDER_RUNNING, WORKFLOW_ROLES.BUILDER],
    [WORKFLOW_PHASES.ESCALATION_DECISIONS, WORKFLOW_ROLES.BUILDER],
    [WORKFLOW_PHASES.READY_FOR_VERIFIER, WORKFLOW_ROLES.BUILDER],
    [WORKFLOW_PHASES.VERIFIER_RUNNING, WORKFLOW_ROLES.VERIFIER],
    [WORKFLOW_PHASES.FINDING_DECISIONS, WORKFLOW_ROLES.VERIFIER],
    [WORKFLOW_PHASES.CANDIDATE_READY, null],
    [WORKFLOW_PHASES.SIMPLIFIER_RUNNING, WORKFLOW_ROLES.SIMPLIFIER],
    [WORKFLOW_PHASES.DRAFTING_SPEC, null],
    [WORKFLOW_PHASES.READY_FOR_BUILDER, null],
  ])(
    'given phase %s when the agent role is requested then the expected role is returned',
    (phase, role) => {
      expect(getAgentRole(phase)).toBe(role);
    },
  );
});
