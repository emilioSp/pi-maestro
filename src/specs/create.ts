/**
 * Objective: Create a proposal, behavioral spec, and initial workflow state.
 * Used: When an owner starts a new Maestro workflow.
 */

import { mkdir, writeFile } from 'node:fs/promises';

import { createSpecId } from '#ids/createSpecId.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { renderSpecTemplate } from '#specs/template.ts';
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
  proposalFilePath: string;
  specFilePath: string;
  designFilePath: string;
  workflowPath: string;
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
  const proposalFilePath = paths.getProposalFilePath(specId);
  const specFilePath = paths.getSpecFilePath(specId);
  const designFilePath = paths.getDesignFilePath(specId);
  const workflowPath = paths.getWorkflowPath(specId);
  const prototypesPath = paths.getPrototypesPath(specId);

  const [proposal, spec] = await Promise.all([
    renderSpecTemplate({ document: 'proposal.md', specId, title }),
    renderSpecTemplate({ document: 'spec.md', specId, title }),
  ]);

  const state = {
    version: WORKFLOW_STATE_VERSION,
    specId,
    phase: WORKFLOW_PHASES.DRAFTING_SPEC,
  } as const;

  assertWorkflowState(state);

  await mkdir(paths.getSpecDirectory(), { recursive: true });
  await mkdir(specPath);

  try {
    await mkdir(prototypesPath, { recursive: true });
    await writeFile(proposalFilePath, proposal, { encoding: 'utf8', flag: 'wx' });
    await writeFile(specFilePath, spec, { encoding: 'utf8', flag: 'wx' });
    await writeWorkflowState({
      path: workflowPath,
      state,
    });
  } catch (error) {
    throw new Error(
      `Spec creation failed after creating ${specPath}. Remove this directory before retrying.`,
      { cause: error },
    );
  }

  return {
    specId,
    specPath,
    proposalFilePath,
    specFilePath,
    designFilePath,
    workflowPath,
    prototypesPath,
    state,
  };
};
