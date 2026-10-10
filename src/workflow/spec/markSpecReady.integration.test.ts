import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import { createTemporaryProject } from '#test/support/temp-repository.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowPhase } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');

const SPEC_ID = '20260321-143052-add-weather-alerts';

const OTHER_SPEC_ID = '20260322-143052-add-weather-alerts';

const cleanupFunctions: Array<() => Promise<void>> = [];

const createRepository = async () => {
  const repository = await createTemporaryProject();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');

  const paths = new MaestroPaths({
    projectRoot: repository.path,
    config: {
      ...DEFAULT_CONFIG,
      specDirectory: join(repository.path, '.specs'),
    },
  });

  return { repository, paths };
};

const createWorkflow = async (
  phase: WorkflowPhase = WORKFLOW_PHASES.DRAFTING_SPEC,
) => {
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
      state: { ...created.state, phase },
    });
  }

  return { created, paths, repository };
};

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('markSpecReady', () => {
  it('given an approved drafting spec when marked ready then the workflow becomes ready without changing the spec', async () => {
    const { paths, created } = await createWorkflow();
    const markdown = '# Owner-approved content\n';
    await writeFile(created.specFilePath, markdown, 'utf8');

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
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });

    await expect(readFile(created.specFilePath, 'utf8')).resolves.toBe(
      markdown,
    );
  });

  it.each([
    WORKFLOW_PHASES.ESCALATION_DECISION,
    WORKFLOW_PHASES.FINDINGS_DECISION,
  ])(
    'given the %s phase when the spec is approved then it becomes ready without changing its content',
    async (phase) => {
      const { created, paths, repository } = await createWorkflow(phase);
      const originalContent = await readFile(created.specFilePath, 'utf8');

      await expect(
        markSpecReady({
          paths,
          specId: SPEC_ID,
          activeWorkflowSpecId: SPEC_ID,
        }),
      ).resolves.toMatchObject({
        specId: SPEC_ID,
        phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      });

      await expect(readFile(created.specFilePath, 'utf8')).resolves.toBe(
        originalContent,
      );
      expect(paths.getProjectRoot()).toBe(repository.path);
    },
  );

  it.each([
    WORKFLOW_PHASES.READY_FOR_BUILDER,
    WORKFLOW_PHASES.BUILDER_RUNNING,
    WORKFLOW_PHASES.BUILDER_FAILED,
    WORKFLOW_PHASES.READY_FOR_VERIFIER,
    WORKFLOW_PHASES.VERIFIER_RUNNING,
    WORKFLOW_PHASES.CANDIDATE_READY,
  ])(
    'given the %s phase when a spec revision is approved then the revision is rejected',
    async (phase) => {
      const { created, paths } = await createWorkflow(phase);

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
        readWorkflowState(created.workflowPath),
      ).resolves.toMatchObject({
        phase,
      });
    },
  );

  it('given a workflow spec ID mismatch when the spec is marked ready then approval is rejected', async () => {
    const { created, paths } = await createWorkflow();
    await writeFile(
      created.workflowPath,
      `${JSON.stringify(
        { ...created.state, specId: OTHER_SPEC_ID },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await expect(
      markSpecReady({
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(
      `Workflow spec ID mismatch: expected "${SPEC_ID}", found "${OTHER_SPEC_ID}".`,
    );
  });

  it('given a missing spec.md when the spec is marked ready then approval is rejected', async () => {
    const { paths, created } = await createWorkflow();
    await rm(created.specFilePath);

    await expect(
      markSpecReady({
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(`Spec file is missing: ${created.specFilePath}.`);
    await expect(readWorkflowState(created.workflowPath)).resolves.toEqual(
      created.state,
    );
  });
});
