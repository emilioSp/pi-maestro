/**
 * Objective: Record owner decisions for every current verifier finding.
 * Used: When the owner resolves a findings-decision handoff.
 */

import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import type { VerifierFinding } from '#artifacts/verifier-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import { createCommit } from '#git/commits/createCommit.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree } from '#workflow/utils/assertWorktree.ts';

export const FINDING_DECISIONS = {
  REJECT: 'reject',
  FIX_CODE: 'fix-code',
} as const;

type FindingDecisionRejected = {
  findingId: string;
  decision: typeof FINDING_DECISIONS.REJECT;
  reason: string;
};

type FindingDecisionApproved = {
  findingId: string;
  decision: typeof FINDING_DECISIONS.FIX_CODE;
};

export type FindingDecision = FindingDecisionApproved | FindingDecisionRejected;

export type ResolvedFindings = {
  findings: VerifierFinding[];
  state: WorkflowState;
  worktreePath: string;
  checkpointCommit: string;
};

const assertDecisions = ({
  decisions,
  findings,
}: {
  decisions: FindingDecision[];
  findings: VerifierFinding[];
}): void => {
  const expectedIds = new Set(findings.map(({ id }) => id));
  const seenIds = new Set<string>();

  for (const decision of decisions) {
    if (!expectedIds.has(decision.findingId)) {
      throw new Error(`Unknown finding ID: "${decision.findingId}".`);
    }

    if (seenIds.has(decision.findingId)) {
      throw new Error(
        `Duplicate decision for finding "${decision.findingId}".`,
      );
    }

    seenIds.add(decision.findingId);

    if (
      decision.decision === FINDING_DECISIONS.REJECT &&
      decision.reason.trim().length === 0
    ) {
      throw new Error(
        `Rejection reason for "${decision.findingId}" must not be empty.`,
      );
    }
  }

  const missing = findings.find(({ id }) => !seenIds.has(id));

  if (missing !== undefined) {
    throw new Error(`Missing decision for finding "${missing.id}".`);
  }
};

export const resolveFindings = async ({
  paths,
  specId,
  pass,
  decisions,
}: {
  paths: GetMaestroPaths;
  specId: string;
  pass: number;
  decisions: FindingDecision[];
}): Promise<ResolvedFindings> => {
  const verifierWorktreePath = paths.getVerifierWorktreePath({ specId, pass });
  const verifierBranch = paths.getVerifierBranch({ specId, pass });
  const builderWorktreePath = paths.getBuilderWorktreePath(specId);
  const builderBranch = paths.getBuilderBranch(specId);

  await assertWorktree({
    repositoryRoot: paths.repositoryRoot,
    branch: verifierBranch,
    worktreePath: verifierWorktreePath,
  });
  await assertWorktree({
    repositoryRoot: paths.repositoryRoot,
    branch: builderBranch,
    worktreePath: builderWorktreePath,
  });

  const workflowPath = paths.getWorkflowPathInWorktree({
    specId,
    worktreePath: verifierWorktreePath,
  });
  const handoffPath = paths.getVerifierHandoffPathInWorktree({
    specId,
    worktreePath: verifierWorktreePath,
  });

  const currentState = await readWorkflowState({ path: workflowPath });

  if (currentState.phase !== WORKFLOW_PHASES.FINDINGS_DECISION) {
    throw new Error(
      `Finding resolution requires findings-decision state, found "${currentState.phase}".`,
    );
  }
  const handoff = await readVerifierHandoff({
    path: handoffPath,
    specId,
    revision: currentState.revision,
  });

  if (handoff.findings.length === 0) {
    throw new Error(
      'Finding resolution requires at least one current finding.',
    );
  }
  if (handoff.findings.some(({ rejection }) => rejection !== null)) {
    throw new Error('Current verifier findings already contain a rejection.');
  }
  assertDecisions({ decisions, findings: handoff.findings });

  // git merge-base --is-ancestor <builder-branch> <verifier-branch>
  // it verifies if builder-branch is fully merged into verifier branch
  await runGitCommand({
    arguments: ['merge-base', '--is-ancestor', builderBranch, verifierBranch],
    cwd: paths.repositoryRoot,
  });

  const decisionsById = new Map(
    decisions.map((decision) => [decision.findingId, decision]),
  );
  const findings = handoff.findings.map((finding) => {
    const decision = decisionsById.get(finding.id);
    if (decision?.decision !== FINDING_DECISIONS.REJECT) return finding;
    return { ...finding, rejection: { reason: decision.reason.trim() } };
  });

  const isFixCodeRequested = decisions.some(
    ({ decision }) => decision === FINDING_DECISIONS.FIX_CODE,
  );

  const event = isFixCodeRequested
    ? WORKFLOW_EVENTS.REQUEST_FIXES
    : WORKFLOW_EVENTS.REJECT_FINDINGS;

  // If we have at least 1 REQUEST_FIXES we return to READY_FOR_BUILDER
  const nextState = transitionWorkflow({ state: currentState, event });

  const nextHandoff = { ...handoff, revision: nextState.revision, findings };
  assertVerifierHandoff(nextHandoff, specId, nextState.revision);
  await writeJsonAtomically({ path: handoffPath, data: nextHandoff });
  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });

  const checkpointCommit = await createCommit({
    repositoryRoot: verifierWorktreePath,
    expectedPaths: [handoffPath, workflowPath],
    message: nextState.phase,
  });

  // move verifier commit to the builder branch
  await runGitCommand({
    arguments: ['merge', '--ff-only', verifierBranch],
    cwd: builderWorktreePath,
  });

  return {
    findings,
    state: nextState,
    worktreePath: builderWorktreePath,
    checkpointCommit,
  };
};
