/**
 * Objective: Create a spec directory, spec file, and initial workflow state.
 * Used: When an owner starts a new Maestro workflow.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { createSpecId } from '#ids/createSpecId.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { loadSpecTemplate, renderSpecTemplate } from '#specs/template.ts';
import { isErrnoException } from '#utils/is-errno-exception.ts';
import { pathExists } from '#utils/path-exists.ts';
import {
  assertWorkflowState,
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

export type CreatedSpec = {
  specId: string;
  specPath: string;
  specFilePath: string;
  workflowPath: string;
  escalationsPath: string;
  prototypesPath: string;
  state: WorkflowState;
};

type CreateSpecInput = {
  paths: MaestroPaths;
  title: string;
  activeWorkflowSpecId: string | null;
  instant?: Temporal.Instant;
};

export const createSpec = async ({
  paths,
  title,
  activeWorkflowSpecId,
  instant,
}: CreateSpecInput): Promise<CreatedSpec> => {
  if (activeWorkflowSpecId !== null) {
    throw new Error(`Workflow ${activeWorkflowSpecId} is already active.`);
  }

  const specId = createSpecId({ title, instant });
  const specPath = paths.getSpecPath(specId);
  const specFilePath = paths.getSpecFilePath(specId);
  const workflowPath = paths.getWorkflowPath(specId);
  const escalationsPath = paths.getEscalationsPath(specId);
  const prototypesPath = paths.getPrototypesPath(specId);

  if (await pathExists(specPath)) {
    throw new Error(`Spec directory already exists: ${specPath}.`);
  }

  const template = await loadSpecTemplate();
  const spec = renderSpecTemplate({ template, specId, title });

  const state = {
    version: WORKFLOW_STATE_VERSION,
    specId,
    revision: 1,
    phase: WORKFLOW_PHASES.DRAFTING_SPEC,
  } as const;

  assertWorkflowState(state);
  let created = false;

  try {
    await mkdir(paths.getSpecDirectory(), { recursive: true });
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
  } catch (error) {
    if (!created && isErrnoException(error) && error.code === 'EEXIST') {
      throw new Error(`Spec directory already exists: ${specPath}.`, {
        cause: error,
      });
    }

    if (created) {
      throw new Error(
        `Spec creation failed after creating ${specPath}. Remove this directory before retrying.`,
        { cause: error },
      );
    }

    throw error;
  }

  return {
    specId,
    specPath,
    specFilePath,
    workflowPath,
    escalationsPath,
    prototypesPath,
    state,
  };
};
