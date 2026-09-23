/**
 * Objective: Compare workflow state with Git resources and handoffs.
 * Used: During activation and workflow inspection without changing state.
 * Entrypoint: reconcileWorkflow().
 */

import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { findWorktree } from '#git/worktrees/findWorktree.ts';
import { listWorktrees } from '#git/worktrees/listWorktrees.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { WORKFLOW_ROLES, type WorkflowRoles } from '#paths.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';

export type WorkflowReconciliation = {
  state: WorkflowState;
  role: WorkflowRoles | null;
  branch: string | null;
  worktreePath: string | null;
  head: string | null;
  terminalHandoff: WorkflowRoles | null;
  interrupted: boolean;
  dirty: boolean;
  issues: readonly string[];
};

const builderResourcePhases = new Set<WorkflowState['phase']>([
  WORKFLOW_PHASES.BUILDER_RUNNING,
  WORKFLOW_PHASES.ESCALATION_DECISION,
  WORKFLOW_PHASES.BUILDER_FAILED,
  WORKFLOW_PHASES.READY_FOR_VERIFIER,
]);

const verifierResourcePhases = new Set<WorkflowState['phase']>([
  WORKFLOW_PHASES.VERIFIER_RUNNING,
  WORKFLOW_PHASES.FINDINGS_DECISION,
  WORKFLOW_PHASES.CANDIDATE_READY,
]);

const builderHandoffPhases = new Set<WorkflowState['phase']>([
  WORKFLOW_PHASES.BUILDER_FAILED,
  WORKFLOW_PHASES.READY_FOR_VERIFIER,
]);

const verifierHandoffPhases = new Set<WorkflowState['phase']>([
  WORKFLOW_PHASES.FINDINGS_DECISION,
  WORKFLOW_PHASES.CANDIDATE_READY,
]);

const isRunning = (phase: WorkflowState['phase']): boolean =>
  phase === WORKFLOW_PHASES.BUILDER_RUNNING ||
  phase === WORKFLOW_PHASES.VERIFIER_RUNNING;

// reconcile workflow state with actual state of the fs
export const reconcileWorkflow = async ({
  paths,
  state,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
}): Promise<WorkflowReconciliation> => {
  const issues: string[] = [];
  let role: WorkflowReconciliation['role'] = null;
  let branch: string | null = null;
  let worktreePath: string | null = null;
  let head: string | null = null;
  let dirty = false;

  if (builderResourcePhases.has(state.phase)) {
    role = WORKFLOW_ROLES.BUILDER;
    const expectedPath = paths.getBuilderWorktreePath(state.specId);
    const expectedBranch = paths.getBuilderBranch(state.specId);
    const worktree = await findWorktree({
      repositoryRoot: paths.repositoryRoot,
      path: expectedPath,
    });
    if (worktree === undefined) {
      issues.push(`Expected builder worktree is missing: ${expectedPath}.`);
    } else if (worktree.branch !== expectedBranch) {
      issues.push(`Expected builder branch is missing: ${expectedBranch}.`);
    } else {
      branch = worktree.branch;
      worktreePath = worktree.path;
      head = worktree.head;
    }
  }

  if (verifierResourcePhases.has(state.phase)) {
    role = WORKFLOW_ROLES.VERIFIER;
    const prefix = `${WORKFLOW_ROLES.VERIFIER}/${state.specId}/`;
    const worktrees = await listWorktrees({
      repositoryRoot: paths.repositoryRoot,
    });
    const worktree = worktrees.find(
      (candidate) => candidate.branch?.startsWith(prefix) === true,
    );
    if (worktree === undefined) {
      issues.push('Expected verifier worktree is missing.');
    } else {
      branch = worktree.branch;
      worktreePath = worktree.path;
      head = worktree.head;
    }
  }

  if (worktreePath !== null) {
    const status = await getRepositoryStatus({ repositoryRoot: worktreePath });
    dirty = !status.clean;
    if (dirty) {
      issues.push(`Expected ${role} worktree is dirty.`);
    }
  }

  let terminalHandoff: WorkflowReconciliation['terminalHandoff'] = null;
  if (builderHandoffPhases.has(state.phase)) {
    terminalHandoff = WORKFLOW_ROLES.BUILDER;
    try {
      await readBuilderHandoff({
        path: paths.getBuilderHandoffPath(state.specId),
        specId: state.specId,
        revision: state.revision,
      });
    } catch {
      issues.push('Builder terminal handoff is missing or invalid.');
    }
  }
  if (verifierHandoffPhases.has(state.phase)) {
    terminalHandoff = WORKFLOW_ROLES.VERIFIER;
    try {
      await readVerifierHandoff({
        path: paths.getVerifierHandoffPath(state.specId),
        specId: state.specId,
        revision: state.revision,
      });
    } catch {
      issues.push('Verifier terminal handoff is missing or invalid.');
    }
  }

  return {
    state,
    role,
    branch,
    worktreePath,
    head,
    terminalHandoff,
    interrupted: isRunning(state.phase),
    dirty,
    issues,
  };
};
