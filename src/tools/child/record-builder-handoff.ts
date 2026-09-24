/**
 * Objective: Register the builder handoff tool for child Pi sessions.
 * Used: When the builder reports a done or failed result.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { BuilderHandoffSubmissionSchema } from '#artifacts/builder-handoff/schema.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { getMaestroPaths, WORKFLOW_ROLES } from '#paths.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';

const BUILDER_HANDOFF_TOOL = {
  NAME: 'maestro_record_builder_handoff',
  LABEL: 'Record Builder Handoff',
  DESCRIPTION:
    'Record the builder pass as done or failed. After success, commit the implementation, handoff, and workflow state together with Bash and Git.',
} as const;

const getBuilderSpecId = async ({
  worktreePath,
}: {
  worktreePath: string;
}): Promise<string> => {
  const branch = await getCurrentBranch({ repositoryRoot: worktreePath });
  const prefix = `${WORKFLOW_ROLES.BUILDER}/`;

  if (!branch.startsWith(prefix)) {
    throw new Error(
      `Builder handoff must run on a "${WORKFLOW_ROLES.BUILDER}/" branch.`,
    );
  }

  const specId = branch.slice(prefix.length);

  if (!isValidSpecId(specId)) {
    throw new Error(`Invalid builder branch name: "${branch}".`);
  }

  return specId;
};

const getMaestroPathsForWorktree = async ({
  worktreePath,
}: {
  worktreePath: string;
}) => {
  const config = await loadConfiguration({ cwd: worktreePath });

  return getMaestroPaths({ repositoryRoot: worktreePath, config });
};

type RegisterRecordBuilderHandoffToolInput = {
  pi: ExtensionAPI;
};

export const registerRecordBuilderHandoffTool = ({
  pi,
}: RegisterRecordBuilderHandoffToolInput): void => {
  pi.registerTool({
    name: BUILDER_HANDOFF_TOOL.NAME,
    label: BUILDER_HANDOFF_TOOL.LABEL,
    description: BUILDER_HANDOFF_TOOL.DESCRIPTION,
    parameters: BuilderHandoffSubmissionSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      const worktreePath = await findRepositoryRoot({ cwd: context.cwd });
      const specId = await getBuilderSpecId({ worktreePath });
      const paths = await getMaestroPathsForWorktree({ worktreePath });
      const completed = await completeBuilderPass({
        paths,
        specId,
        handoff: params,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Builder handoff recorded as ${completed.handoff.status}. Commit your implementation, workflow state, and builder handoff together with Bash and Git, then stop.`,
          },
        ],
        details: {
          specId: completed.handoff.specId,
          revision: completed.handoff.revision,
          phase: completed.state.phase,
        },
      };
    },
  });
};
