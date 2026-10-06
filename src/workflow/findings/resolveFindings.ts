/**
 * Objective: Record owner decisions for current verifier findings on the current branch.
 * Used: When the owner resolves a findings-decision handoff.
 */

import { relative } from 'node:path';
import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import type {
  VerifierFinding,
  VerifierHandoff,
} from '#artifacts/verifier-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import { createWorkflowCheckpointCommit } from '#git/commits/createWorkflowCheckpointCommit.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

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
  repositoryRoot: string;
  checkpointCommit: string;
};

type AssertDecisionsInput = {
  decisions: FindingDecision[];
  findings: VerifierFinding[];
};

function assertDecisions({ decisions, findings }: AssertDecisionsInput): void {
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
}

type FindingWorkflow = {
  state: WorkflowState;
  handoff: VerifierHandoff;
};

type ReadFindingWorkflowInput = {
  paths: MaestroPaths;
  specId: string;
};

const readFindingWorkflow = async ({
  paths,
  specId,
}: ReadFindingWorkflowInput): Promise<FindingWorkflow> => {
  const state = await readWorkflowState(paths.getWorkflowPath(specId));

  if (state.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
    );
  }

  if (state.phase !== WORKFLOW_PHASES.FINDINGS_DECISION) {
    throw new Error(
      `Finding resolution requires findings-decision state, found "${state.phase}".`,
    );
  }

  const handoff = await readVerifierHandoff({
    path: paths.getVerifierHandoffPath(specId),
    specId,
    revision: state.revision,
  });

  if (handoff.findings.length === 0) {
    throw new Error(
      'Finding resolution requires at least one current finding.',
    );
  }

  if (handoff.findings.some(({ rejection }) => rejection !== null)) {
    throw new Error('Current verifier findings already contain a rejection.');
  }

  return { state, handoff };
};

type BuildFindingWorkflowInput = {
  workflow: FindingWorkflow;
  decisions: FindingDecision[];
};

const buildFindingWorkflow = ({
  workflow,
  decisions,
}: BuildFindingWorkflowInput): FindingWorkflow => {
  const { state, handoff } = workflow;
  assertDecisions({ decisions, findings: handoff.findings });

  const decisionsById = new Map(
    decisions.map((decision) => [decision.findingId, decision]),
  );

  const findings = handoff.findings.map((finding) => {
    const decision = decisionsById.get(finding.id);

    if (decision?.decision !== FINDING_DECISIONS.REJECT) {
      return finding;
    }

    return { ...finding, rejection: { reason: decision.reason.trim() } };
  });

  const isFixCodeRequested = decisions.some(
    (decision) => decision.decision === FINDING_DECISIONS.FIX_CODE,
  );

  const nextState = transitionWorkflow({
    state,
    event: isFixCodeRequested
      ? WORKFLOW_EVENTS.REQUEST_FIXES
      : WORKFLOW_EVENTS.REJECT_FINDINGS,
  });

  const nextHandoff = { ...handoff, revision: nextState.revision, findings };
  assertVerifierHandoff({
    handoff: nextHandoff,
    specId: state.specId,
    revision: nextState.revision,
  });

  return { state: nextState, handoff: nextHandoff };
};

type AssertNoChangesOutsideFindingArtifactsInput = {
  repositoryRoot: string;
  workflowPath: string;
  handoffPath: string;
};

async function assertNoChangesOutsideFindingArtifacts({
  repositoryRoot,
  workflowPath,
  handoffPath,
}: AssertNoChangesOutsideFindingArtifactsInput): Promise<void> {
  const headCommit = await getHeadCommit(repositoryRoot);

  // Compare both the checkout and index with HEAD. The index comparison also
  // catches staged changes when the working file was restored on disk.
  const [diff, stagedDiff, status] = await Promise.all([
    runGitCommand({
      arguments: [
        'diff',
        '--no-renames',
        '--name-only',
        '-z',
        headCommit,
        '--',
      ],
      cwd: repositoryRoot,
    }),
    runGitCommand({
      arguments: [
        'diff',
        '--cached',
        '--no-renames',
        '--name-only',
        '-z',
        headCommit,
        '--',
      ],
      cwd: repositoryRoot,
    }),
    getRepositoryStatus(repositoryRoot),
  ]);

  const allowedPaths = new Set([
    relative(repositoryRoot, workflowPath),
    relative(repositoryRoot, handoffPath),
  ]);

  const changedTrackedPaths = [diff.stdout, stagedDiff.stdout]
    .flatMap((output) => output.split('\0'))
    .filter((path) => path.length > 0);

  if (
    changedTrackedPaths.some((path) => !allowedPaths.has(path)) ||
    status.untracked.some((path) => !allowedPaths.has(path))
  ) {
    throw new Error(
      'Finding resolution requires no changes outside its protocol files.',
    );
  }
}

type CommitFindingWorkflowInput = {
  paths: MaestroPaths;
  specId: string;
  currentRevision: number;
  workflow: FindingWorkflow;
};

const commitFindingWorkflow = async ({
  paths,
  specId,
  currentRevision,
  workflow,
}: CommitFindingWorkflowInput): Promise<string> => {
  const repositoryRoot = paths.getRepositoryRoot();
  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getVerifierHandoffPath(specId);

  await assertNoChangesOutsideFindingArtifacts({
    repositoryRoot,
    workflowPath,
    handoffPath,
  });

  await writeJsonAtomically({ path: handoffPath, data: workflow.handoff });
  await writeWorkflowState({
    path: workflowPath,
    state: workflow.state,
    currentRevision,
  });

  const checkpointCommit = await createWorkflowCheckpointCommit({
    repositoryRoot,
    expectedPaths: [handoffPath, workflowPath],
  });

  if (!(await getRepositoryStatus(repositoryRoot)).clean) {
    throw new Error(
      'Finding resolution requires a clean checkout after its commit.',
    );
  }

  return checkpointCommit;
};

type ResolveFindingsInput = {
  paths: MaestroPaths;
  specId: string;
  decisions: FindingDecision[];
};

export const resolveFindings = async ({
  paths,
  specId,
  decisions,
}: ResolveFindingsInput): Promise<ResolvedFindings> => {
  const currentWorkflow = await readFindingWorkflow({ paths, specId });

  const workflow = buildFindingWorkflow({
    workflow: currentWorkflow,
    decisions,
  });

  const checkpointCommit = await commitFindingWorkflow({
    paths,
    specId,
    currentRevision: currentWorkflow.state.revision,
    workflow,
  });

  return {
    findings: workflow.handoff.findings,
    state: workflow.state,
    repositoryRoot: paths.getRepositoryRoot(),
    checkpointCommit,
  };
};
