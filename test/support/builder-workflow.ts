/**
 * Objective: Create approved workflows and handoff data for tests.
 * Used: In workflow integration tests that need a temporary Git repository.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { createSpec } from '#specs/create.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';

export const INSTANT = Temporal.Instant.from('2026-03-21T14:30:52Z');

export const SPEC_ID = '20260321-143052-add-weather-alerts';

const cleanupFunctions: Array<() => Promise<void>> = [];

type CreateApprovedWorkflowInput = {
  commitApproval?: boolean;
  specDirectory?: string;
};

export const createApprovedWorkflow = async ({
  commitApproval = true,
  specDirectory = '.specs',
}: CreateApprovedWorkflowInput = {}) => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
  const configDirectory = join(repository.path, '.pi');
  await mkdir(configDirectory, { recursive: true });
  await writeFile(
    join(configDirectory, 'maestro.json'),
    JSON.stringify({ version: DEFAULT_CONFIG.version, specDirectory }, null, 2),
    'utf8',
  );
  await repository.commit('Initial commit');

  const config = await loadConfiguration(repository.path);
  const paths = new MaestroPaths({ repositoryRoot: repository.path, config });
  await createSpec({
    paths,
    title: 'Add Weather Alerts',
    activeWorkflowSpecId: null,
    instant: INSTANT,
  });
  await markSpecReady({
    paths,
    specId: SPEC_ID,
    activeWorkflowSpecId: SPEC_ID,
  });
  maestroSessionState.activate();
  maestroSessionState.setActiveSpecId(SPEC_ID);

  if (commitApproval) {
    await repository.commit('Approve builder spec');
  }

  return { paths, repository };
};

export const cleanupBuilderWorkflows = async (): Promise<void> => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
  maestroSessionState.deactivate();
};

export const doneHandoff = (revision: number): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision,
  status: BUILDER_HANDOFF_STATUSES.DONE,
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

export const failedHandoff = (revision: number): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision,
  status: BUILDER_HANDOFF_STATUSES.FAILED,
  summary: 'The builder could not complete the approved change.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test',
      probeStatus: PROBE_STATUSES.NOT_RUN,
    },
  ],
  failure: { reason: 'The implementation was blocked.' },
  notes: [],
});
