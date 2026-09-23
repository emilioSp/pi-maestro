import { describe, expect, it } from 'vitest';
import { assertBuilderHandoffHasExpectedFields } from '#artifacts/builder-handoff/assertBuilderHandoffHasExpectedFields.ts';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';

const specId = '20260321-143052-add-weather-alerts';

const doneHandoff = (): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId,
  revision: 4,
  status: BUILDER_HANDOFF_STATUSES.DONE,
  summary: 'Implemented the approved change.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test -- alert',
      probeStatus: PROBE_STATUSES.PASSED,
      breakageStatus: BREAKAGE_STATUSES.CONFIRMED,
    },
  ],
  notes: [],
});

describe('builder handoff workflow identity', () => {
  it('requires the workflow identity and revision', () => {
    expect(() =>
      assertBuilderHandoffHasExpectedFields({
        handoff: doneHandoff(),
        specId: '20260321-143052-other-change',
        revision: 4,
      }),
    ).toThrow('Builder handoff spec ID mismatch');

    expect(() =>
      assertBuilderHandoffHasExpectedFields({
        handoff: doneHandoff(),
        specId,
        revision: 5,
      }),
    ).toThrow('Builder handoff revision mismatch');
  });
});
