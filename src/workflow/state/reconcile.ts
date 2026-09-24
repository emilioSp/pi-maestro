/**
 * Objective: Compare workflow state with Git resources and handoffs.
 * Used: During activation and workflow inspection without changing state.
 */

import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { findWorktree } from '#git/worktrees/findWorktree.ts';
import { listWorktrees, type Worktree } from '#git/worktrees/listWorktrees.ts';
import type { GetMaestroPaths, WorkflowRoles } from '#paths.ts';
import { WORKFLOW_ROLES } from '#paths.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';
import { getAgentRole } from '#workflow/utils/getAgentRole.ts';

export type WorkflowReconciliation = {
  state: WorkflowState;
  role: WorkflowRoles | null;
  branch: string | null;
  worktreePath: string | null;
  head: string | null;
  interrupted: boolean;
  dirty: boolean | null;
  issues: readonly string[];
};

const isRunning = (phase: WorkflowState['phase']): boolean =>
  phase === WORKFLOW_PHASES.BUILDER_RUNNING ||
  phase === WORKFLOW_PHASES.VERIFIER_RUNNING;

type WorkflowFileSystemResult = {
  worktree: Worktree | null;
  issues: string[];
};

const getBuilderFileSystemIssues = async ({
  paths,
  specId,
}: {
  paths: GetMaestroPaths;
  specId: string;
}): Promise<WorkflowFileSystemResult> => {
  const expectedPath = paths.getBuilderWorktreePath(specId);
  const expectedBranch = paths.getBuilderBranch(specId);
  const worktree = await findWorktree({
    repositoryRoot: paths.repositoryRoot,
    path: expectedPath,
  });

  if (worktree === undefined) {
    return {
      worktree: null,
      issues: [`Expected builder worktree is missing: ${expectedPath}.`],
    };
  }

  if (worktree.branch !== expectedBranch) {
    return {
      worktree: null,
      issues: [`Expected builder branch is missing: ${expectedBranch}.`],
    };
  }

  return { worktree, issues: [] };
};

const matchesVerifierState = async ({
  paths,
  state,
  worktree,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
  worktree: Worktree;
}): Promise<boolean> => {
  try {
    const candidateState = await readWorkflowState({
      path: paths.getWorkflowPathInWorktree({
        specId: state.specId,
        worktreePath: worktree.path,
      }),
    });

    return (
      candidateState.specId === state.specId &&
      candidateState.revision === state.revision &&
      candidateState.phase === state.phase
    );
  } catch {
    return false;
  }
};

const getVerifierFileSystemIssues = async ({
  paths,
  state,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
}): Promise<WorkflowFileSystemResult> => {
  const prefix = `${WORKFLOW_ROLES.VERIFIER}/${state.specId}/`;
  const worktrees = await listWorktrees({
    repositoryRoot: paths.repositoryRoot,
  });
  const verifierWorktrees = worktrees.filter(
    (worktree) => worktree.branch?.startsWith(prefix) === true,
  );
  const matches = await Promise.all(
    verifierWorktrees.map(async (worktree) => ({
      worktree,
      matchesState: await matchesVerifierState({ paths, state, worktree }),
    })),
  );
  const currentWorktrees = matches
    .filter(({ matchesState }) => matchesState)
    .map(({ worktree }) => worktree);

  if (currentWorktrees.length !== 1) {
    return {
      worktree: null,
      issues: [
        'Expected exactly one verifier worktree matching the current workflow state.',
      ],
    };
  }

  return { worktree: currentWorktrees[0], issues: [] };
};

const getWorkflowFileSystemIssues = async ({
  paths,
  state,
  role,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
  role: WorkflowRoles | null;
}): Promise<WorkflowFileSystemResult> => {
  if (role === WORKFLOW_ROLES.BUILDER) {
    return getBuilderFileSystemIssues({ paths, specId: state.specId });
  }

  if (role === WORKFLOW_ROLES.VERIFIER) {
    return getVerifierFileSystemIssues({ paths, state });
  }

  return { worktree: null, issues: [] };
};

type WorktreeStatusAndIssues = {
  dirty: boolean | null;
  issues: string[];
};

const getWorktreeStatusAndIssues = async ({
  worktree,
  role,
}: {
  worktree: Worktree | null;
  role: WorkflowRoles | null;
}): Promise<WorktreeStatusAndIssues> => {
  if (worktree === null) {
    return { dirty: null, issues: [] };
  }

  const status = await getRepositoryStatus({ repositoryRoot: worktree.path });
  const dirty = !status.clean;

  return {
    dirty,
    issues: dirty ? [`Expected ${role} worktree is dirty.`] : [],
  };
};

const getHandoffIssues = async ({
  paths,
  state,
  worktree,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
  worktree: Worktree | null;
}): Promise<string[]> => {
  const hasHandoff = (
    [
      WORKFLOW_PHASES.BUILDER_FAILED,
      WORKFLOW_PHASES.READY_FOR_VERIFIER,
      WORKFLOW_PHASES.FINDINGS_DECISION,
      WORKFLOW_PHASES.CANDIDATE_READY,
    ] as WorkflowState['phase'][]
  ).includes(state.phase);

  if (!hasHandoff) return [];

  const role = getAgentRole(state.phase);
  if (!role) return [];

  const errorMessage =
    role === WORKFLOW_ROLES.BUILDER
      ? 'Builder handoff is missing or invalid.'
      : 'Verifier handoff is missing or invalid.';

  if (worktree === null) return [errorMessage];

  try {
    const handoffPath =
      role === WORKFLOW_ROLES.BUILDER
        ? paths.getBuilderHandoffPathInWorktree({
            specId: state.specId,
            worktreePath: worktree.path,
          })
        : paths.getVerifierHandoffPathInWorktree({
            specId: state.specId,
            worktreePath: worktree.path,
          });

    if (role === WORKFLOW_ROLES.BUILDER) {
      await readBuilderHandoff({
        path: handoffPath,
        specId: state.specId,
        revision: state.revision,
      });
    } else {
      await readVerifierHandoff({
        path: handoffPath,
        specId: state.specId,
        revision: state.revision,
      });
    }

    return [];
  } catch {
    return [errorMessage];
  }
};

export const reconcileWorkflow = async ({
  paths,
  state,
}: {
  paths: GetMaestroPaths;
  state: WorkflowState;
}): Promise<WorkflowReconciliation> => {
  const role = getAgentRole(state.phase);

  const resource = await getWorkflowFileSystemIssues({ paths, state, role });
  const worktreeStatus = await getWorktreeStatusAndIssues({
    worktree: resource.worktree,
    role,
  });

  const handoffIssues = await getHandoffIssues({
    paths,
    state,
    worktree: resource.worktree,
  });

  const issues = [
    ...resource.issues,
    ...worktreeStatus.issues,
    ...handoffIssues,
  ];

  return {
    state,
    role,
    branch: resource.worktree?.branch ?? null,
    worktreePath: resource.worktree?.path ?? null,
    head: resource.worktree?.head ?? null,
    interrupted: isRunning(state.phase),
    dirty: worktreeStatus.dirty,
    issues,
  };
};
