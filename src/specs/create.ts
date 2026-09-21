import { mkdir, writeFile } from 'node:fs/promises';
import { writeJsonAtomically } from '#atomic-write.ts';
import { createSpecId } from '#ids.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { loadSpecTemplate, renderSpecTemplate } from '#specs/template.ts';
import { pathExists } from '#utils/path-exists.ts';
import {
  validateWorkflowState,
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/store.ts';

export const OBSERVATIONS_VERSION = '1.0.0';

export type InitialObservations = {
  version: typeof OBSERVATIONS_VERSION;
  specId: string;
  passes: [];
};

export type CreatedSpec = {
  specId: string;
  specPath: string;
  specFilePath: string;
  workflowPath: string;
  observationsPath: string;
  escalationsPath: string;
  prototypesPath: string;
  state: WorkflowState;
  observations: InitialObservations;
};

export const createSpec = async ({
  paths,
  title,
  baseBranch,
  activeWorkflowSpecId,
  instant,
}: {
  paths: GetMaestroPaths;
  title: string;
  baseBranch: string;
  activeWorkflowSpecId: string | null;
  instant?: Temporal.Instant;
}): Promise<CreatedSpec> => {
  if (activeWorkflowSpecId !== null) {
    throw new Error(`Workflow ${activeWorkflowSpecId} is already active.`);
  }
  if (baseBranch.trim().length === 0) {
    throw new Error('Base branch must be non-empty.');
  }

  const specId = createSpecId({ title, instant });
  const specPath = paths.getSpecPath(specId);
  const specFilePath = paths.getSpecFilePath(specId);
  const workflowPath = paths.getWorkflowPath(specId);
  const observationsPath = paths.getObservationsPath(specId);
  const escalationsPath = paths.getEscalationsPath(specId);
  const prototypesPath = paths.getPrototypesPath(specId);

  if (await pathExists(specPath)) {
    throw new Error(`Spec directory already exists: ${specPath}.`);
  }

  const template = await loadSpecTemplate();
  const spec = renderSpecTemplate({ template, specId, title });
  const state = validateWorkflowState({
    version: WORKFLOW_STATE_VERSION,
    specId,
    revision: 1,
    phase: WORKFLOW_PHASES.DRAFTING_SPEC,
    baseBranch,
  });
  const observations: InitialObservations = {
    version: OBSERVATIONS_VERSION,
    specId,
    passes: [],
  };

  let created = false;
  try {
    await mkdir(paths.specDirectory, { recursive: true });
    await mkdir(specPath);
    created = true;
    await mkdir(escalationsPath, { recursive: true });
    await mkdir(prototypesPath, { recursive: true });
    await writeFile(specFilePath, spec, { encoding: 'utf8', flag: 'wx' });
    await writeWorkflowState({
      path: workflowPath,
      state,
      currentRevision: 0,
    });
    await writeJsonAtomically({ path: observationsPath, data: observations });
  } catch (cause) {
    if (!created && (cause as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Spec directory already exists: ${specPath}.`, { cause });
    }
    if (created) {
      throw new Error(
        `Spec creation failed after creating ${specPath}. Remove this directory before retrying.`,
        { cause },
      );
    }
    throw cause;
  }

  return {
    specId,
    specPath,
    specFilePath,
    workflowPath,
    observationsPath,
    escalationsPath,
    prototypesPath,
    state,
    observations,
  };
};
