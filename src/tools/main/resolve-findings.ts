/**
 * Objective: Register owner decisions for current verifier findings.
 * Used: When the owner invokes the resolve-findings tool.
 */

import { StringEnum } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { FINDING_DECISIONS } from '#artifacts/verifier-handoff/schema.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { resolveFindings } from '#workflow/verifier/resolveFindings.ts';

export const RESOLVE_FINDINGS_TOOL = {
  NAME: 'maestro_resolve_findings',
  LABEL: 'Resolve Findings',
  DESCRIPTION:
    'Record the complete explicit owner decision batch for current verifier findings before changing phase. Any revise-spec decision returns to drafting-spec without approval or an agent run. Then revise the same spec with the owner, obtain renewed GREEN FLAG, and call maestro_mark_spec_ready separately before running the builder.',
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
  {
    additionalProperties: false,
  },
);

const FixCodeFindingDecisionSchema = Type.Object(
  {
    ...FindingDecisionFields,
    decision: StringEnum([FINDING_DECISIONS.FIX_CODE] as const),
  },
  {
    additionalProperties: false,
  },
);

const ReviseSpecFindingDecisionSchema = Type.Object(
  {
    ...FindingDecisionFields,
    decision: StringEnum([FINDING_DECISIONS.REVISE_SPEC] as const),
    reason: Type.String({ minLength: 1, pattern: '\\S' }),
    specChange: Type.String({ minLength: 1, pattern: '\\S' }),
  },
  { additionalProperties: false },
);

const FindingDecisionSchema = Type.Union([
  RejectFindingDecisionSchema,
  FixCodeFindingDecisionSchema,
  ReviseSpecFindingDecisionSchema,
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
  phase: string;
  projectRoot: string;
  rejectedFindingIds: string[];
  findingsRequiringFixIds: string[];
  findingsRequiringSpecRevisionIds: string[];
};

const formatFindingIds = (findingIds: string[]): string =>
  findingIds.length === 0 ? 'none' : findingIds.join(', ');

const formatResolution = (details: FindingResolutionDetails): string => {
  const rejected = formatFindingIds(details.rejectedFindingIds);
  const requiringFix = formatFindingIds(details.findingsRequiringFixIds);
  const summary = `Recorded rejections for ${rejected}. Findings requiring code fixes: ${requiringFix}.`;

  if (details.phase === WORKFLOW_PHASES.DRAFTING_SPEC) {
    const requiringRevision = formatFindingIds(
      details.findingsRequiringSpecRevisionIds,
    );

    return `${summary} Findings requiring spec revision: ${requiringRevision}. The workflow is drafting-spec. Revise the same spec with the owner and obtain renewed GREEN FLAG. Then call maestro_mark_spec_ready separately before running the builder.`;
  }

  if (details.phase === WORKFLOW_PHASES.READY_FOR_BUILDER) {
    return `${summary} The workflow is ready-for-builder. Run the builder separately.`;
  }

  return `${summary} The workflow is simplifier-running. Call maestro_run_simplifier next with this specId, without another approval or verifier pass.`;
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
      const { paths } = await resolveToolRunContext(context.cwd);

      const resolved = await resolveFindings({
        paths,
        specId,
        decisions,
      });

      const details: FindingResolutionDetails = {
        specId: resolved.state.specId,
        phase: resolved.state.phase,
        projectRoot: resolved.projectRoot,
        rejectedFindingIds: resolved.findings
          .filter(
            ({ decision }) => decision?.decision === FINDING_DECISIONS.REJECT,
          )
          .map(({ id }) => id),
        findingsRequiringSpecRevisionIds: resolved.findings
          .filter(
            ({ decision }) =>
              decision?.decision === FINDING_DECISIONS.REVISE_SPEC,
          )
          .map(({ id }) => id),
        findingsRequiringFixIds: resolved.findings
          .filter(
            ({ decision }) => decision?.decision === FINDING_DECISIONS.FIX_CODE,
          )
          .map(({ id }) => id),
      };

      return {
        content: [{ type: 'text', text: formatResolution(details) }],
        details,
      };
    },
  });
};
