/**
 * Objective: Create approved workflows and handoff data for tests.
 * Used: In workflow integration tests that need a temporary project.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoffSubmissionInput,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import type { PartialMaestroConfig } from '#config/schema.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { createSpec } from '#specs/create.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';

export const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');

export const SPEC_ID = '20260321-143052-add-weather-alerts';

type CreateApprovedWorkflowInput = {
  specDirectory?: string;
  agents?: Pick<PartialMaestroConfig, 'builder' | 'verifier' | 'simplifier'>;
};

export const createApprovedWorkflow = async ({
  specDirectory = '.specs',
  agents = {},
}: CreateApprovedWorkflowInput = {}) => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  const configDirectory = join(repository.path, '.pi');
  await mkdir(configDirectory, { recursive: true });
  await writeFile(
    join(configDirectory, 'maestro.json'),
    JSON.stringify(
      {
        ...TEST_CONFIG,
        specDirectory,
        builder: { ...TEST_CONFIG.builder, ...agents.builder },
        verifier: { ...TEST_CONFIG.verifier, ...agents.verifier },
        simplifier: { ...TEST_CONFIG.simplifier, ...agents.simplifier },
      },
      null,
      2,
    ),
    'utf8',
  );

  const config = await loadConfiguration(repository.path);
  const paths = new MaestroPaths({ projectRoot: repository.path, config });
  await createSpec({
    paths,
    title: 'Add Weather Alerts',
    activeWorkflowSpecId: null,
    instant: INSTANT,
  });

  const state = await markSpecReady({
    config,
    paths,
    specId: SPEC_ID,
    activeWorkflowSpecId: SPEC_ID,
  });

  return { paths, repository, state };
};

export const doneHandoff = (): BuilderHandoffSubmissionInput => ({
  status: BUILDER_HANDOFF_STATUSES.DONE,
  escalations: [],
  summary: 'Implemented the approved change.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test',
      probeStatus: PROBE_STATUSES.PASSED,
    },
  ],
  notes: [],
});
