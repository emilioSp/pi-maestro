/**
 * Objective: Atomically write a validated workflow state at a new revision.
 * Used: When Maestro persists a workflow transition.
 */

import { type FileHandle, open, rm } from 'node:fs/promises';
import { pathExists } from '#utils/path-exists.ts';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  assertWorkflowState,
  type WorkflowState,
} from '#workflow/state/schema.ts';

export const writeWorkflowState = async ({
  path,
  state,
  currentRevision,
}: {
  path: string;
  state: WorkflowState;
  currentRevision: number;
}): Promise<void> => {
  assertWorkflowState(state);
  if (!Number.isSafeInteger(currentRevision) || currentRevision < 0) {
    throw new Error(
      'Expected workflow revision must be a non-negative integer.',
    );
  }
  if (state.revision <= currentRevision) {
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

    await writeJsonAtomically({ path, data: state });
  } finally {
    if (lock !== undefined) {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
};
