/**
 * Objective: Register owner resolution of the current builder escalation.
 * Used: When the owner keeps the approved contract and chooses an escalation resolution.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  ESCALATION_ID_PATTERN,
  EscalationResolutionSchema,
} from '#artifacts/escalation/schema.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';
import { SPEC_ID_PATTERN } from '#ids/isValidSpecId.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { resolveBuilderEscalation } from '#workflow/escalation/resolveBuilderEscalation.ts';

export const RESOLVE_ESCALATION_TOOL = {
  NAME: 'maestro_resolve_escalation',
  LABEL: 'Resolve Escalation',
  DESCRIPTION:
    'Record the explicit owner decision for the current builder escalation when the approved contract remains valid. Commit the resolution and workflow transition on the current branch, then return ready-for-builder without launching the builder. If the contract must change, edit spec.md and use maestro_mark_spec_ready instead.',
} as const;

const ResolveEscalationToolParameters = Type.Object(
  {
    specId: Type.String({ pattern: SPEC_ID_PATTERN.source }),
    escalationId: Type.String({ pattern: ESCALATION_ID_PATTERN.source }),
    ...EscalationResolutionSchema.properties,
  },
  { additionalProperties: false },
);

const resolvePaths = async (cwd: string): Promise<MaestroPaths> => {
  const repositoryRoot = await findRepositoryRoot({ cwd });
  const config = await loadConfiguration({ cwd: repositoryRoot });

  return new MaestroPaths({ repositoryRoot, config });
};

export const registerResolveEscalationTool = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: RESOLVE_ESCALATION_TOOL.NAME,
    label: RESOLVE_ESCALATION_TOOL.LABEL,
    description: RESOLVE_ESCALATION_TOOL.DESCRIPTION,
    parameters: ResolveEscalationToolParameters,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      const { specId, escalationId, ...resolution } = params;
      const paths = await resolvePaths(context.cwd);

      const resolved = await resolveBuilderEscalation({
        paths,
        specId,
        escalationId,
        resolution,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Escalation ${resolved.escalation.id} resolved. Spec ${resolved.state.specId} is ready-for-builder. Launch the builder separately.`,
          },
        ],
        details: {
          specId: resolved.state.specId,
          escalationId: resolved.escalation.id,
          revision: resolved.state.revision,
          phase: resolved.state.phase,
          repositoryRoot: resolved.repositoryRoot,
          checkpointCommit: resolved.checkpointCommit,
        },
      };
    },
  });
};
