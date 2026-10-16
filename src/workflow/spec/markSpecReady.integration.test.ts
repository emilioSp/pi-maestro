/**
 * Objective: Check spec approval rules and preservation of saved files.
 * Used: In integration tests for drafting and invalid approval phases.
 */

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

const createWorkflow = async (
  phase: WorkflowPhase = WORKFLOW_PHASES.DRAFTING_SPEC,
) => {
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
  it('given an owner-approved draft when approval is requested then the wrong spec ID is rejected and the active spec becomes ready-for-builder without content changes', async () => {
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
    { numbers: [2] },
    { numbers: [1, 3] },
    { numbers: [1, 1] },
    { numbers: [1, 3, 2] },
  ])(
    'given a draft with acceptance criterion numbers $numbers when approval is requested then a numbering error prevents approval and leaves all saved files unchanged',
    async ({ numbers }) => {
      const { created, paths } = await createWorkflow();
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
        phase: WORKFLOW_PHASES.DRAFTING_SPEC,
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
    'given a workflow in %s rather than drafting-spec when approval is requested then approval fails and the workflow keeps its current phase',
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

  it('given the saved workflow names a different spec when approval is requested then approval fails with a workflow spec ID mismatch error', async () => {
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

  it('given spec.md is missing when approval is requested then approval fails with the missing file path and leaves the workflow unchanged', async () => {
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
