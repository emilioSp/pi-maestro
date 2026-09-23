/**
 * Objective: Build escalation paths inside the builder worktree.
 * Used: By builder escalation opening and resolution.
 */

import type { GetMaestroPaths } from '#paths.ts';
import { getPath } from '#workflow/utils.ts';

export const getBuilderEscalationsPath = ({
  paths,
  worktreePath,
  specId,
}: {
  paths: GetMaestroPaths;
  worktreePath: string;
  specId: string;
}): string =>
  getPath({
    paths,
    worktreePath,
    target: paths.getEscalationsPath(specId),
  });

export const getBuilderEscalationPath = ({
  paths,
  worktreePath,
  specId,
  escalationNumber,
}: {
  paths: GetMaestroPaths;
  worktreePath: string;
  specId: string;
  escalationNumber: number;
}): string =>
  getPath({
    paths,
    worktreePath,
    target: paths.getEscalationPath({ specId, escalationNumber }),
  });
