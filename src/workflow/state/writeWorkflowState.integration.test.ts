import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_PHASES,
  WORKFLOW_STATE_VERSION,
  type WorkflowPhase,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

const temporaryDirectories: string[] = [];

const state = (phase: WorkflowPhase): WorkflowState => ({
  version: WORKFLOW_STATE_VERSION,
  specId: '20260321-143052-add-weather-alerts',
  phase,
});

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('writeWorkflowState', () => {
  it('creates and replaces validated state', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'pi-maestro-workflow-state-'),
    );

    temporaryDirectories.push(directory);

    const path = join(directory, 'workflow.json');

    await writeWorkflowState({
      path,
      state: state(WORKFLOW_PHASES.DRAFTING_SPEC),
    });

    await writeWorkflowState({
      path,
      state: state(WORKFLOW_PHASES.READY_FOR_BUILDER),
    });

    await expect(readWorkflowState(path)).resolves.toEqual(
      state(WORKFLOW_PHASES.READY_FOR_BUILDER),
    );

    await expect(readFile(path, 'utf8')).resolves.toBe(
      `${JSON.stringify(state(WORKFLOW_PHASES.READY_FOR_BUILDER), null, 2)}\n`,
    );
  });

  it('rejects invalid replacement state and preserves the old file', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'pi-maestro-workflow-state-'),
    );

    temporaryDirectories.push(directory);

    const path = join(directory, 'workflow.json');
    await writeWorkflowState({
      path,
      state: state(WORKFLOW_PHASES.DRAFTING_SPEC),
    });
    const before = await readFile(path, 'utf8');

    const invalid = {
      ...state(WORKFLOW_PHASES.READY_FOR_BUILDER),
      version: '2.0.0',
    };

    // JUSTIFICATION: The invalid version tests the runtime boundary without changing the writer type.
    await expect(
      writeWorkflowState({ path, state: invalid as ReturnType<typeof state> }),
    ).rejects.toThrow('Invalid workflow state');

    await expect(readFile(path, 'utf8')).resolves.toBe(before);
  });
});
