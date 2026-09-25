/**
 * Objective: Record owner decisions for current verifier findings on the current branch.
 * Used: When the owner resolves a findings-decision handoff.
 */

import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import type { VerifierFinding } from '#artifacts/verifier-handoff/schema.ts';
import { createCommit } from '#git/commits/createCommit.ts';
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
  decisions,
}: {
  paths: MaestroPaths;
  specId: string;
  decisions: FindingDecision[];
}): Promise<ResolvedFindings> => {
  const repositoryRoot = paths.getRepositoryRoot();
  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getVerifierHandoffPath(specId);
  const currentState = await readWorkflowState({ path: workflowPath });

  if (currentState.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${currentState.specId}".`,
    );
  }

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
  const event = isFixCodeRequested
    ? WORKFLOW_EVENTS.REQUEST_FIXES
    : WORKFLOW_EVENTS.REJECT_FINDINGS;
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
    repositoryRoot,
    expectedPaths: [handoffPath, workflowPath],
    message: nextState.phase,
  });

  return {
    findings,
    state: nextState,
    repositoryRoot,
    checkpointCommit,
  };
};
