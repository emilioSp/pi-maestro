import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_VERSION } from '#artifacts/builder-handoff/schema.ts';
import { writeBuilderHandoff } from '#artifacts/builder-handoff/writeBuilderHandoff.ts';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { writeVerifierHandoff } from '#artifacts/verifier-handoff/writeVerifierHandoff.ts';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import { unavailableCompilerEscalation } from '#tests/fixtures/unavailable-compiler-escalation.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
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
    {
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      numbers: [2],
    },
    {
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      numbers: [1, 3],
    },
    {
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      numbers: [1, 1],
    },
    {
      phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      numbers: [1, 3, 2],
    },
  ])(
    'given criteria $numbers in $phase when approved then an ordering error leaves all saved files unchanged',
    async ({ phase, numbers }) => {
      const { created, paths } = await createWorkflow(phase);
      await writeFile(
        created.specFilePath,
        numbers.map((number) => `### AC${number}: Criterion\n`).join('\n'),
        'utf8',
      );
      await mkdir(paths.getBuilderHandoffsPath(SPEC_ID), { recursive: true });
      await mkdir(paths.getVerifierHandoffsPath(SPEC_ID), { recursive: true });

      const builderHandoffPath = paths.getBuilderHandoffPath({
        specId: SPEC_ID,
        handoffPassNumber: 1,
      });

      const verifierHandoffPath = paths.getVerifierHandoffPath({
        specId: SPEC_ID,
        handoffPassNumber: 1,
      });

      await writeBuilderHandoff({
        path: builderHandoffPath,
        specId: SPEC_ID,
        handoff: {
          ...unavailableCompilerEscalation,
          version: BUILDER_HANDOFF_VERSION,
          specId: SPEC_ID,
        },
      });
      await writeVerifierHandoff({
        path: verifierHandoffPath,
        specId: SPEC_ID,
        handoff: {
          version: VERIFIER_HANDOFF_VERSION,
          specId: SPEC_ID,
          summary: 'Previous verifier pass.',
          acceptanceCriteria: [],
          findings: [],
          notes: [],
        },
      });

      const savedPaths = [
        created.specFilePath,
        created.workflowPath,
        builderHandoffPath,
        verifierHandoffPath,
      ];

      const savedContents = await Promise.all(
        savedPaths.map((path) => readFile(path)),
      );

      const savedEntries = await readdir(created.specPath, { recursive: true });

      await expect(
        markSpecReady({
          paths,
          specId: SPEC_ID,
          activeWorkflowSpecId: SPEC_ID,
        }),
      ).rejects.toThrow('Fix acceptance criterion ordering in spec.md.');

      expect(
        await Promise.all(savedPaths.map((path) => readFile(path))),
      ).toEqual(savedContents);
      expect(await readdir(created.specPath, { recursive: true })).toEqual(
        savedEntries,
      );
      await expect(
        readWorkflowState(created.workflowPath),
      ).resolves.toMatchObject({
        phase,
      });
    },
  );

  it.each([
    WORKFLOW_PHASES.ESCALATION_DECISIONS,
    WORKFLOW_PHASES.FINDING_DECISIONS,
    WORKFLOW_PHASES.READY_FOR_BUILDER,
    WORKFLOW_PHASES.BUILDER_RUNNING,
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
