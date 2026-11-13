/**
 * Objective: Check spec approval rules and preservation of saved files.
 * Used: In integration tests for drafting and invalid approval phases.
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import { BUILDER_HANDOFF_VERSION } from '#artifacts/builder-handoff/schema.ts';
import { writeBuilderHandoff } from '#artifacts/builder-handoff/writeBuilderHandoff.ts';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { writeVerifierHandoff } from '#artifacts/verifier-handoff/writeVerifierHandoff.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { unavailableCompilerEscalation } from '#tests/fixtures/unavailable-compiler-escalation.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowPhase } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');

const SPEC_ID = '20260321-143052-add-weather-alerts';

const OTHER_SPEC_ID = '20260322-143052-add-weather-alerts';

const createWorkflow = async (phase: WorkflowPhase = WORKFLOW_PHASES.DRAFTING_SPEC) => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');

  const paths = new MaestroPaths({
    projectRoot: repository.path,
    config: {
      ...TEST_CONFIG,
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

describe('markSpecReady', () => {
  it('GIVEN an active draft WHEN approval names another spec THEN the ID mismatch is reported and all documents and the workflow stay unchanged', async () => {
    const { paths, created } = await createWorkflow();
    const markdown = '# Owner-approved content\n';
    await writeFile(created.specFilePath, markdown, 'utf8');
    await writeFile(created.proposalFilePath, '# Approved proposal\n', 'utf8');
    await writeFile(created.designFilePath, '# Approved design\n', 'utf8');
    const documentPaths = [created.proposalFilePath, created.specFilePath, created.designFilePath];
    const documentsBefore = await Promise.all(documentPaths.map((path) => readFile(path, 'utf8')));

    const workflowBefore = await readFile(created.workflowPath, 'utf8');

    await expect(
      markSpecReady({
        config: TEST_CONFIG,
        paths,
        specId: OTHER_SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(
      `Active workflow spec ID mismatch: expected "${OTHER_SPEC_ID}", found "${SPEC_ID}".`,
    );
    expect(await Promise.all(documentPaths.map((path) => readFile(path, 'utf8')))).toEqual(
      documentsBefore,
    );
    expect(await readFile(created.workflowPath, 'utf8')).toBe(workflowBefore);
  });

  it('GIVEN an approved proposal, spec, and design WHEN approval names the active spec THEN the workflow becomes ready-for-builder without changing the documents', async () => {
    const { paths, created } = await createWorkflow();
    const markdown = '# Owner-approved content\n';
    await writeFile(created.specFilePath, markdown, 'utf8');
    await writeFile(created.proposalFilePath, '# Approved proposal\n', 'utf8');
    await writeFile(created.designFilePath, '# Approved design\n', 'utf8');
    const documentPaths = [created.proposalFilePath, created.specFilePath, created.designFilePath];
    const documentsBefore = await Promise.all(documentPaths.map((path) => readFile(path, 'utf8')));

    await expect(
      markSpecReady({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });

    expect(await Promise.all(documentPaths.map((path) => readFile(path, 'utf8')))).toEqual(
      documentsBefore,
    );
    await expect(readWorkflowState(created.workflowPath)).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
  });

  it('GIVEN nested AC1 and standalone regression AC3 WHEN approval is requested THEN global numbering rejects the gap without changing the draft or workflow', async () => {
    const { created, paths } = await createWorkflow();

    const markdown = (
      await readFile(
        new URL('../../../tests/fixtures/two-acceptance-criteria-spec.md', import.meta.url),
        'utf8',
      )
    ).replace('### AC2:', '### AC3:');

    await writeFile(created.specFilePath, markdown, 'utf8');

    await expect(
      markSpecReady({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow('Fix acceptance criterion ordering in spec.md.');
    await expect(readFile(created.specFilePath, 'utf8')).resolves.toBe(markdown);
    await expect(readWorkflowState(created.workflowPath)).resolves.toEqual(created.state);
  });

  it.each([{ numbers: [2] }, { numbers: [1, 3] }, { numbers: [1, 1] }, { numbers: [1, 3, 2] }])(
    'GIVEN a draft with nested acceptance criterion numbers $numbers WHEN approval is requested THEN a numbering error prevents approval and leaves all saved files unchanged',
    async ({ numbers }) => {
      const { created, paths } = await createWorkflow();
      await writeFile(
        created.specFilePath,
        numbers.map((number) => `#### AC${number}: Criterion\n`).join('\n'),
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

      await writeFile(created.designFilePath, '# Agreed technical decisions\n', 'utf8');

      const savedPaths = [
        created.proposalFilePath,
        created.designFilePath,
        created.specFilePath,
        created.workflowPath,
        builderHandoffPath,
        verifierHandoffPath,
      ];

      const savedContents = await Promise.all(savedPaths.map((path) => readFile(path)));

      const savedEntries = await readdir(created.specPath, { recursive: true });

      await expect(
        markSpecReady({
          config: TEST_CONFIG,
          paths,
          specId: SPEC_ID,
          activeWorkflowSpecId: SPEC_ID,
        }),
      ).rejects.toThrow('Fix acceptance criterion ordering in spec.md.');

      expect(await Promise.all(savedPaths.map((path) => readFile(path)))).toEqual(savedContents);
      expect(await readdir(created.specPath, { recursive: true })).toEqual(savedEntries);
      await expect(readWorkflowState(created.workflowPath)).resolves.toMatchObject({
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
    'GIVEN a workflow in %s rather than drafting-spec WHEN approval is requested THEN approval fails and the workflow keeps its current phase',
    async (phase) => {
      const { created, paths } = await createWorkflow(phase);

      await expect(
        markSpecReady({
          config: TEST_CONFIG,
          paths,
          specId: SPEC_ID,
          activeWorkflowSpecId: SPEC_ID,
        }),
      ).rejects.toThrow(`Workflow event "mark-spec-ready" is not allowed from phase "${phase}".`);

      await expect(readWorkflowState(created.workflowPath)).resolves.toMatchObject({
        phase,
      });
    },
  );

  it('GIVEN the saved workflow names a different spec WHEN approval is requested THEN approval fails with a workflow spec ID mismatch error', async () => {
    const { created, paths } = await createWorkflow();
    await writeFile(
      created.workflowPath,
      `${JSON.stringify({ ...created.state, specId: OTHER_SPEC_ID }, null, 2)}\n`,
      'utf8',
    );

    await expect(
      markSpecReady({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(
      `Workflow spec ID mismatch: expected "${SPEC_ID}", found "${OTHER_SPEC_ID}".`,
    );
  });

  it('GIVEN proposal.md is missing WHEN approval is requested THEN approval fails with the missing proposal path and leaves the workflow unchanged', async () => {
    const { paths, created } = await createWorkflow();
    await rm(created.proposalFilePath);

    await expect(
      markSpecReady({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(`Proposal file is missing: ${created.proposalFilePath}.`);
    await expect(readWorkflowState(created.workflowPath)).resolves.toEqual(created.state);
  });

  it('GIVEN spec.md is missing WHEN approval is requested THEN approval fails with the missing file path and leaves the workflow unchanged', async () => {
    const { paths, created } = await createWorkflow();
    await rm(created.specFilePath);

    await expect(
      markSpecReady({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        activeWorkflowSpecId: SPEC_ID,
      }),
    ).rejects.toThrow(`Spec file is missing: ${created.specFilePath}.`);
    await expect(readWorkflowState(created.workflowPath)).resolves.toEqual(created.state);
  });
});
