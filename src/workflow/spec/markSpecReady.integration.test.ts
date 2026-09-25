import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowPhase } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');
const SPEC_ID = '20260321-143052-add-weather-alerts';
const OTHER_SPEC_ID = '20260322-143052-add-weather-alerts';
const cleanupFunctions: Array<() => Promise<void>> = [];

type CreateWorkflowInput = {
  phase?: WorkflowPhase;
};

const createRepository = async () => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
  await repository.commit({ message: 'Initial commit' });
  const paths = new MaestroPaths({
    repositoryRoot: repository.path,
    config: {
      ...DEFAULT_CONFIG,
      specDirectory: join(repository.path, '.specs'),
    },
  });

  return { repository, paths };
};

const createWorkflow = async ({
  phase = WORKFLOW_PHASES.DRAFTING_SPEC,
}: CreateWorkflowInput = {}) => {
  const { repository, paths } = await createRepository();
  const created = await createSpec({
    paths,
    title: 'Add Weather Alerts',
    activeWorkflowSpecId: null,
    instant: INSTANT,
  });

  if (phase !== WORKFLOW_PHASES.DRAFTING_SPEC) {
    await writeWorkflowState({
      path: created.workflowPath,
      state: { ...created.state, phase, revision: 2 },
      currentRevision: created.state.revision,
    });
  }

  return { created, paths, repository };
};

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('markSpecReady', () => {
  it('moves the approved drafting spec to ready without committing', async () => {
    const { repository, paths, created } = await createWorkflow();
    const markdown = '# Owner-approved content\n';
    await writeFile(created.specFilePath, markdown, 'utf8');
    const headBefore = await getHeadCommit({ repositoryRoot: repository.path });

    await expect(
      markSpecReady({
        paths,
        specId: OTHER_SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(
      `Active workflow spec ID mismatch: expected "${OTHER_SPEC_ID}", found "${SPEC_ID}".`,
    );
    await expect(
      markSpecReady({
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).resolves.toMatchObject({
      revision: 2,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });

    await expect(readFile(created.specFilePath, 'utf8')).resolves.toBe(
      markdown,
    );
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(headBefore);
  });

  it.each([
    WORKFLOW_PHASES.ESCALATION_DECISION,
    WORKFLOW_PHASES.FINDINGS_DECISION,
  ])(
    'approves the spec from %s without changing its content',
    async (phase) => {
      const { created, paths, repository } = await createWorkflow({ phase });
      const originalContent = await readFile(created.specFilePath, 'utf8');

      await expect(
        markSpecReady({
          paths,
          specId: SPEC_ID,
          activeWorkflowSpecId: SPEC_ID,
        }),
      ).resolves.toMatchObject({
        specId: SPEC_ID,
        revision: 3,
        phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      });

      await expect(readFile(created.specFilePath, 'utf8')).resolves.toBe(
        originalContent,
      );
      expect(paths.getRepositoryRoot()).toBe(repository.path);
    },
  );

  it.each([
    WORKFLOW_PHASES.READY_FOR_BUILDER,
    WORKFLOW_PHASES.BUILDER_RUNNING,
    WORKFLOW_PHASES.BUILDER_FAILED,
    WORKFLOW_PHASES.READY_FOR_VERIFIER,
    WORKFLOW_PHASES.VERIFIER_RUNNING,
    WORKFLOW_PHASES.CANDIDATE_READY,
    WORKFLOW_PHASES.FINAL_REVIEW,
  ])('rejects a spec revision from %s', async (phase) => {
    const { created, paths } = await createWorkflow({ phase });

    await expect(
      markSpecReady({
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(
      `Workflow event "mark-spec-ready" is not allowed from phase "${phase}".`,
    );

    await expect(
      readWorkflowState({ path: created.workflowPath }),
    ).resolves.toMatchObject({
      revision: 2,
      phase,
    });
  });

  it('rejects readiness when spec.md is missing', async () => {
    const { paths, created } = await createWorkflow();
    await rm(created.specFilePath);

    await expect(
      markSpecReady({
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(`Spec file is missing: ${created.specFilePath}.`);
    await expect(
      readWorkflowState({ path: created.workflowPath }),
    ).resolves.toEqual(created.state);
  });
});
