/**
 * Objective: Register owner decisions for current verifier findings.
 * Used: When the owner invokes the resolve-findings tool.
 */

import { StringEnum } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { resolveToolLaunchContext } from '#tools/utils/resolveToolLaunchContext.ts';
import {
  FINDING_DECISIONS,
  resolveFindings,
} from '#workflow/findings/resolveFindings.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

export const RESOLVE_FINDINGS_TOOL = {
  NAME: 'maestro_resolve_findings',
  LABEL: 'Resolve Findings',
  DESCRIPTION:
    'Record the explicit owner decision for every current verifier finding when the approved contract remains valid. Commit the resolution and workflow transition on the current branch. If the contract must change, edit spec.md and use maestro_mark_spec_ready instead.',
} as const;

const FindingDecisionFields = {
  findingId: Type.String({ minLength: 1 }),
};

const RejectFindingDecisionSchema = Type.Object(
  {
    ...FindingDecisionFields,
    decision: StringEnum([FINDING_DECISIONS.REJECT] as const),
    reason: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const FixCodeFindingDecisionSchema = Type.Object(
  {
    ...FindingDecisionFields,
    decision: StringEnum([FINDING_DECISIONS.FIX_CODE] as const),
  },
  { additionalProperties: false },
);

const FindingDecisionSchema = Type.Union([
  RejectFindingDecisionSchema,
  FixCodeFindingDecisionSchema,
]);

const ResolveFindingsToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    decisions: Type.Array(FindingDecisionSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

type FindingResolutionDetails = {
  specId: string;
  revision: number;
  phase: string;
  repositoryRoot: string;
  checkpointCommit: string;
  rejectedFindingIds: string[];
  findingsRequiringFixIds: string[];
};

const formatFindingIds = (findingIds: string[]): string =>
  findingIds.length === 0 ? 'none' : findingIds.join(', ');

const formatResolution = ({
  details,
}: {
  details: FindingResolutionDetails;
}): string => {
  const rejected = formatFindingIds(details.rejectedFindingIds);
  const requiringFix = formatFindingIds(details.findingsRequiringFixIds);

  if (details.phase === WORKFLOW_PHASES.READY_FOR_BUILDER) {
    return `Recorded rejections for ${rejected}. Findings requiring code fixes: ${requiringFix}. The workflow is ready-for-builder. Launch the builder separately.`;
  }

  return `Recorded rejections for ${rejected}. Findings requiring code fixes: ${requiringFix}. The workflow is candidate-ready.`;
};

export const registerResolveFindingsTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: RESOLVE_FINDINGS_TOOL.NAME,
    label: RESOLVE_FINDINGS_TOOL.LABEL,
    description: RESOLVE_FINDINGS_TOOL.DESCRIPTION,
    parameters: ResolveFindingsToolParameters,
    async execute(
      _toolCallId,
      { specId, decisions },
      _signal,
      _onUpdate,
      context,
    ) {
      const { paths } = await resolveToolLaunchContext({ cwd: context.cwd });

      const resolved = await resolveFindings({
        paths,
        specId,
        decisions,
      });

      const details: FindingResolutionDetails = {
        specId: resolved.state.specId,
        revision: resolved.state.revision,
        phase: resolved.state.phase,
        repositoryRoot: resolved.repositoryRoot,
        checkpointCommit: resolved.checkpointCommit,
        rejectedFindingIds: resolved.findings
          .filter(({ rejection }) => rejection !== null)
          .map(({ id }) => id),
        findingsRequiringFixIds: resolved.findings
          .filter(({ rejection }) => rejection === null)
          .map(({ id }) => id),
      };

      return {
        content: [{ type: 'text', text: formatResolution({ details }) }],
        details,
      };
    },
  });
};
