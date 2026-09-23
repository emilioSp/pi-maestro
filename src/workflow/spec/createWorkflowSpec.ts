/**
 * Objective: Coordinate creation of a drafting workflow spec.
 * Used: When an owner creates a new spec.
 */

import type { GetMaestroPaths } from '#paths.ts';
import { type CreatedSpec, createSpec } from '#specs/create.ts';
import { discoverActiveWorkflow } from '#workflow/state/discover.ts';

export const createWorkflowSpec = async ({
  paths,
  title,
  baseBranch,
  instant,
}: {
  paths: GetMaestroPaths;
  title: string;
  baseBranch: string;
  instant?: Temporal.Instant;
}): Promise<CreatedSpec> => {
  const activeWorkflow = await discoverActiveWorkflow({ paths });

  return createSpec({
    paths,
    title,
    baseBranch,
    activeWorkflowSpecId: activeWorkflow?.specId ?? null,
    instant,
  });
};
