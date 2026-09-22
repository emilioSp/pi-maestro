import { describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  PROBE_STATUSES,
  validateBuilderHandoff,
  validateBuilderHandoffForWorkflow,
} from '#artifacts/builder-handoff.ts';

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

const failedHandoff = (): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId,
  revision: 4,
  status: BUILDER_HANDOFF_STATUSES.FAILED,
  summary: 'The migration could not be completed.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test -- alert',
      probeStatus: PROBE_STATUSES.NOT_RUN,
      breakageStatus: BREAKAGE_STATUSES.NOT_RUN,
    },
  ],
  failure: { reason: 'The required service is unavailable.' },
  notes: ['No product files were changed.'],
});

describe('builder handoff schema', () => {
  it('accepts a done handoff with completed checks', () => {
    expect(validateBuilderHandoff(doneHandoff())).toEqual(doneHandoff());
  });

  it('accepts a failed handoff with explicit partial checks', () => {
    expect(validateBuilderHandoff(failedHandoff())).toEqual(failedHandoff());
  });

  it.each([
    {
      handoff: {
        ...doneHandoff(),
        acceptanceCriteria: [
          ...doneHandoff().acceptanceCriteria,
          { ...doneHandoff().acceptanceCriteria[0] },
        ],
      },
      message: 'acceptance criterion IDs must be unique',
    },
    {
      handoff: {
        ...doneHandoff(),
        acceptanceCriteria: [
          { ...doneHandoff().acceptanceCriteria[0], probeStatus: 'unknown' },
        ],
      },
      message: 'Invalid builder handoff',
    },
    {
      handoff: {
        ...doneHandoff(),
        acceptanceCriteria: [
          {
            ...doneHandoff().acceptanceCriteria[0],
            probeStatus: PROBE_STATUSES.FAILED,
          },
        ],
      },
      message: 'Done builder handoff requires every probe to pass',
    },
    {
      handoff: {
        ...failedHandoff(),
        acceptanceCriteria: doneHandoff().acceptanceCriteria,
      },
      message: 'Failed builder handoff requires at least one',
    },
    {
      handoff: {
        ...failedHandoff(),
        failure: { reason: '' },
      },
      message: 'Invalid builder handoff',
    },
    {
      handoff: { ...doneHandoff(), summary: '' },
      message: 'Invalid builder handoff',
    },
    {
      handoff: { ...doneHandoff(), extra: true },
      message: 'Invalid builder handoff',
    },
    {
      handoff: {
        ...doneHandoff(),
        acceptanceCriteria: [
          { ...doneHandoff().acceptanceCriteria[0], extra: true },
        ],
      },
      message: 'Invalid builder handoff',
    },
    {
      handoff: {
        ...failedHandoff(),
        failure: { reason: 'Blocked.', extra: true },
      },
      message: 'Invalid builder handoff',
    },
  ])('rejects invalid handoff data %#', ({ handoff, message }) => {
    expect(() => validateBuilderHandoff(handoff)).toThrow(message);
  });

  it('rejects a structurally valid spec ID with an invalid UTC date', () => {
    expect(() =>
      validateBuilderHandoff({
        ...doneHandoff(),
        specId: '20260230-143052-add-weather-alerts',
      }),
    ).toThrow('Invalid builder handoff spec ID');
  });

  it('requires the workflow identity and revision', () => {
    expect(() =>
      validateBuilderHandoffForWorkflow({
        handoff: doneHandoff(),
        specId: '20260321-143052-other-change',
        revision: 4,
      }),
    ).toThrow('Builder handoff spec ID mismatch');

    expect(() =>
      validateBuilderHandoffForWorkflow({
        handoff: doneHandoff(),
        specId,
        revision: 5,
      }),
    ).toThrow('Builder handoff revision mismatch');
  });
});
