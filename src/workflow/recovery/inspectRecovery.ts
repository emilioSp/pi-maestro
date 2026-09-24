/**
 * Objective: Report safe resume and retry options for an existing workflow.
 * Used: During explicit Maestro activation after a restart or interruption.
 */

import { branchExists } from '#git/branches/branchExists.ts';
import { runGitCommand } from '#git/command.ts';
import { isAncestor } from '#git/history/isAncestor.ts';
import { listWorktrees } from '#git/worktrees/listWorktrees.ts';
import type { GetMaestroPaths, WorkflowRoles } from '#paths.ts';
import { WORKFLOW_ROLES } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import {
  reconcileWorkflow,
  type WorkflowReconciliation,
} from '#workflow/state/reconcile.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';

export const RECOVERY_ACTIONS = {
  RETRY_BUILDER: 'retry-builder',
  RETRY_VERIFIER: 'retry-verifier',
} as const;

export const RECOVERY_STATUSES = {
  READY: 'ready',
  INTERRUPTED: 'interrupted',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
} as const;

export type RecoveryAction =
  (typeof RECOVERY_ACTIONS)[keyof typeof RECOVERY_ACTIONS];

export type RecoveryInspection = {
  state: WorkflowState;
  status: (typeof RECOVERY_STATUSES)[keyof typeof RECOVERY_STATUSES];
  role: WorkflowRoles | null;
  branch: string | null;
  worktreePath: string | null;
  head: string | null;
  dirty: boolean | null;
  retryAction: RecoveryAction | null;
  resumeAllowed: boolean;
  issues: readonly string[];
};

const isRunningPhase = (phase: WorkflowState['phase']): boolean =>
  phase === WORKFLOW_PHASES.BUILDER_RUNNING ||
  phase === WORKFLOW_PHASES.VERIFIER_RUNNING;

const getRecoveryStatus = ({
  issues,
  phase,
}: {
  issues: readonly string[];
  phase: WorkflowState['phase'];
}): RecoveryInspection['status'] => {
  const canProceed = issues.length === 0;
  if (!canProceed) return RECOVERY_STATUSES.BLOCKED;
  if (isRunningPhase(phase)) return RECOVERY_STATUSES.INTERRUPTED;
  return RECOVERY_STATUSES.READY;
};

const getRetryAction = ({
  issues,
  phase,
  role,
}: {
  issues: readonly string[];
  phase: WorkflowState['phase'];
  role: WorkflowRoles | null;
}): RecoveryInspection['retryAction'] => {
  if (issues.length > 0 || !isRunningPhase(phase)) return null;
  if (role === WORKFLOW_ROLES.BUILDER) return RECOVERY_ACTIONS.RETRY_BUILDER;
  if (role === WORKFLOW_ROLES.VERIFIER) return RECOVERY_ACTIONS.RETRY_VERIFIER;
  return null;
};

const getResumeAllowed = ({
  issues,
  phase,
}: {
  issues: readonly string[];
  phase: WorkflowState['phase'];
}): boolean => issues.length === 0 && !isRunningPhase(phase);

const getRunningHandoffPath = ({
  paths,
  state,
  role,
  worktreePath,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
  role: WorkflowRoles | null;
  worktreePath: string;
}): string => {
  if (role === WORKFLOW_ROLES.BUILDER) {
    return paths.getBuilderHandoffPathInWorktree({
      specId: state.specId,
      worktreePath,
    });
  }

  return paths.getVerifierHandoffPathInWorktree({
    specId: state.specId,
    worktreePath,
  });
};

/*
`getGitBranchIssues` checks whether the workflow branches still have the expected Git history. It only reports problems; it does not change any branches.


5. If the active role is the builder, it checks that the base branch is an ancestor of the builder branch. In other words, the builder branch must include the base branch’s history. If not, it reports broken ancestry and returns.
6. Otherwise, the active role is the verifier. It checks that the builder branch exists.
7. It checks two links: the base branch must be an ancestor of the builder branch, and the builder branch must be an ancestor of the verifier branch.
8. If either link is broken, it reports a verifier ancestry issue. Then it returns the issues it found.

An *ancestor* here means an earlier commit in the branch’s history.
 */
const getGitBranchIssues = async ({
  paths,
  state,
  role,
  branch,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
  role: WorkflowRoles | null;
  branch: string | null;
}): Promise<string[]> => {
  const issues: string[] = [];

  // If there is no active role or branch, there is no branch history to check, so it returns an empty list.
  if (role === null || branch === null) return issues;

  // It checks that the workflow’s base branch exists. If not, it reports that and stops.
  const hasBaseBranch = await branchExists({
    repositoryRoot: paths.repositoryRoot,
    branch: state.baseBranch,
  });

  if (!hasBaseBranch) {
    issues.push(`Workflow base branch is missing: ${state.baseBranch}.`);
    return issues;
  }

  const builderBranch = paths.getBuilderBranch(state.specId);

  // If the active role is the builder, it checks that the base branch is an ancestor of the builder branch. In other words, the builder branch must include the base branch’s history.
  // If not, it reports broken ancestry and returns.
  if (role === WORKFLOW_ROLES.BUILDER) {
    if (
      !(await isAncestor({
        repositoryRoot: paths.repositoryRoot,
        ancestor: state.baseBranch,
        descendant: builderBranch,
      }))
    ) {
      issues.push(
        'Builder branch has broken ancestry from the workflow base branch.',
      );
    }

    return issues;
  }

  // ROLE IS VERIFIER
  // The active role is the verifier. It checks that the builder branch exists.
  const hasBuilderBranch = await branchExists({
    repositoryRoot: paths.repositoryRoot,
    branch: builderBranch,
  });

  if (!hasBuilderBranch) {
    issues.push(`Expected builder branch is missing: ${builderBranch}.`);
    return issues;
  }

  // Check: the base branch must be an ancestor of the builder branch, and the builder branch must be an ancestor of the verifier branch.
  const baseContainsBuilder = await isAncestor({
    repositoryRoot: paths.repositoryRoot,
    ancestor: state.baseBranch,
    descendant: builderBranch,
  });
  const builderContainsVerifier = await isAncestor({
    repositoryRoot: paths.repositoryRoot,
    ancestor: builderBranch,
    descendant: branch,
  });

  if (!baseContainsBuilder || !builderContainsVerifier) {
    issues.push(
      'Verifier branch has broken ancestry from the workflow builder branch.',
    );
  }

  return issues;
};

const detectIssues = async ({
  paths,
  state,
  reconciliation,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
  reconciliation: WorkflowReconciliation;
}): Promise<string[]> => {
  const issues = [...reconciliation.issues];

  if (isRunningPhase(state.phase) && reconciliation.worktreePath !== null) {
    const handoffPath = getRunningHandoffPath({
      paths,
      state,
      role: reconciliation.role,
      worktreePath: reconciliation.worktreePath,
    });

    if (await pathExists(handoffPath)) {
      issues.push(
        'A handoff exists while the workflow is still in a running phase.',
      );
    }
  }

  issues.push(
    ...(await getGitBranchIssues({
      paths,
      state,
      role: reconciliation.role,
      branch: reconciliation.branch,
    })),
  );

  return issues;
};

const getFinalReviewIssues = async ({
  paths,
  specId,
}: {
  paths: GetMaestroPaths;
  specId: string;
}): Promise<string[]> => {
  const [branches, worktrees] = await Promise.all([
    runGitCommand({
      arguments: [
        'for-each-ref',
        '--format=%(refname:short)',
        `refs/heads/${WORKFLOW_ROLES.BUILDER}/${specId}`,
        `refs/heads/${WORKFLOW_ROLES.VERIFIER}/${specId}`,
      ],
      cwd: paths.repositoryRoot,
    }),
    listWorktrees({ repositoryRoot: paths.repositoryRoot }),
  ]);

  const associatedWorktrees = worktrees.filter(
    ({ branch }) =>
      branch?.startsWith(`${WORKFLOW_ROLES.BUILDER}/${specId}`) === true ||
      branch?.startsWith(`${WORKFLOW_ROLES.VERIFIER}/${specId}/`) === true,
  );

  if (branches.stdout.trim().length === 0 && associatedWorktrees.length === 0) {
    return [];
  }

  return [
    `Completed workflow still has Maestro branches or worktrees for ${specId}; clean them up manually.`,
  ];
};

export const inspectRecovery = async ({
  paths,
  state,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
}): Promise<RecoveryInspection> => {
  if (state.phase === WORKFLOW_PHASES.FINAL_REVIEW) {
    return {
      state,
      status: RECOVERY_STATUSES.COMPLETED,
      role: null,
      branch: null,
      worktreePath: null,
      head: null,
      dirty: null,
      retryAction: null,
      resumeAllowed: false,
      issues: await getFinalReviewIssues({ paths, specId: state.specId }),
    };
  }

  const reconciliation = await reconcileWorkflow({ paths, state });
  const issues = await detectIssues({ paths, state, reconciliation });

  return {
    state,
    status: getRecoveryStatus({ issues, phase: state.phase }),
    role: reconciliation.role,
    branch: reconciliation.branch,
    worktreePath: reconciliation.worktreePath,
    head: reconciliation.head,
    dirty: reconciliation.dirty,
    retryAction: getRetryAction({
      issues,
      phase: state.phase,
      role: reconciliation.role,
    }),
    resumeAllowed: getResumeAllowed({ issues, phase: state.phase }),
    issues,
  };
};
