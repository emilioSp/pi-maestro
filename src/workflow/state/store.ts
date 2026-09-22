/**
 * Objective: Read and write validated workflow state files.
 * Used: Whenever a workflow phase or event is persisted.
 * Entrypoint: writeWorkflowState().
 */

import { type FileHandle, open, readFile, rm } from 'node:fs/promises';
import { writeJsonAtomically } from '#atomic-write.ts';
import { pathExists } from '#utils/path-exists.ts';
import {
  validateWorkflowState,
  type WorkflowState,
} from '#workflow/state/schema.ts';

const readJson = async (path: string): Promise<unknown> => {
  const content = await readFile(path, 'utf8');
  try {
    return JSON.parse(content);
  } catch (cause) {
    throw new Error(`Workflow state contains malformed JSON: ${path}.`, {
      cause,
    });
  }
};

export const readWorkflowState = async ({
  path,
}: {
  path: string;
}): Promise<WorkflowState> => validateWorkflowState(await readJson(path));

export const writeWorkflowState = async ({
  path,
  state,
  currentRevision,
}: {
  path: string;
  state: WorkflowState;
  currentRevision: number;
}): Promise<void> => {
  const validatedState = validateWorkflowState(state);
  if (!Number.isSafeInteger(currentRevision) || currentRevision < 0) {
    throw new Error(
      'Expected workflow revision must be a non-negative integer.',
    );
  }
  if (validatedState.revision <= currentRevision) {
    throw new Error(
      `Workflow revision must be higher than expected revision ${currentRevision}.`,
    );
  }

  const lockPath = `${path}.lock`;
  let lock: FileHandle | undefined;
  try {
    try {
      lock = await open(lockPath, 'wx', 0o600);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error('Another workflow state update is in progress.', {
          cause,
        });
      }
      throw cause;
    }

    const exists = await pathExists(path);
    if (!exists && currentRevision !== 0) {
      throw new Error(
        `Stale workflow revision: expected ${currentRevision}, but no state exists.`,
      );
    }
    if (exists) {
      const current = await readWorkflowState({ path });
      if (current.revision !== currentRevision) {
        throw new Error(
          `Stale workflow revision: expected ${currentRevision}, found ${current.revision}.`,
        );
      }
    }

    await writeJsonAtomically({ path, data: validatedState });
  } finally {
    if (lock !== undefined) {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
};
