/**
 * Objective: Record owner decisions for current verifier findings on the active handoff.
 * Used: When the owner resolves a finding-decisions handoff.
 */

import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import type {
  VerifierFinding,
  VerifierHandoff,
} from '#artifacts/verifier-handoff/schema.ts';
import { FINDING_DECISIONS } from '#artifacts/verifier-handoff/schema.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { writeJson } from '#utils/write-json.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { getWorkflowEventByVerifierHandoff } from '#workflow/verifier/utils/getWorkflowEventByVerifierHandoff.ts';

type SavedFindingDecision = NonNullable<VerifierFinding['decision']>;

export type FindingDecision = SavedFindingDecision & {
  findingId: string;
};

export type ResolvedFindings = {
  findings: VerifierFinding[];
  state: WorkflowState;
  projectRoot: string;
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

  if (state.phase !== WORKFLOW_PHASES.FINDING_DECISIONS) {
    throw new Error(
      `Finding resolution requires finding-decisions state, found "${state.phase}".`,
    );
  }

  const handoff = await readVerifierHandoff({
    path: await paths.getActiveVerifierHandoffPath(specId),
    specId,
  });

  if (handoff.findings.length === 0) {
    throw new Error(
      'Finding resolution requires at least one current finding.',
    );
  }

  if (handoff.findings.some(({ decision }) => decision !== null)) {
    throw new Error(
      'Current verifier findings already contain an owner decision.',
    );
  }

  return { state, handoff };
};

const getSavedFindingDecision = (
  decision: FindingDecision | undefined,
): SavedFindingDecision => {
  if (decision?.decision === FINDING_DECISIONS.REVISE_SPEC) {
    return {
      decision: FINDING_DECISIONS.REVISE_SPEC,
      reason: decision.reason.trim(),
      specChange: decision.specChange,
    };
  }

  if (decision?.decision === FINDING_DECISIONS.REJECT) {
    return {
      decision: FINDING_DECISIONS.REJECT,
      reason: decision.reason.trim(),
    };
  }

  return { decision: FINDING_DECISIONS.FIX_CODE };
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
  const { state, handoff } = await readFindingWorkflow({ paths, specId });
  assertDecisions({ decisions, findings: handoff.findings });

  const decisionsById = new Map(
    decisions.map((decision) => [decision.findingId, decision]),
  );

  const findings = handoff.findings.map((finding) => ({
    ...finding,
    decision: getSavedFindingDecision(decisionsById.get(finding.id)),
  }));

  const nextHandoff = { ...handoff, findings };

  const nextState = transitionWorkflow({
    state,
    event: getWorkflowEventByVerifierHandoff(nextHandoff),
  });

  assertVerifierHandoff({
    handoff: nextHandoff,
    specId: state.specId,
  });

  const handoffPath = await paths.getActiveVerifierHandoffPath(specId);
  await writeJson({ path: handoffPath, data: nextHandoff });
  await writeWorkflowState({
    path: paths.getWorkflowPath(specId),
    state: nextState,
  });

  return {
    findings,
    state: nextState,
    projectRoot: paths.getProjectRoot(),
  };
};
