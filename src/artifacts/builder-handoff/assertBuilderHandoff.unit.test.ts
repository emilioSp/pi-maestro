import { describe, expect, it } from 'vitest';
import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';

const specId = '20260321-143052-add-weather-alerts';

const doneHandoff = (): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId,
  status: BUILDER_HANDOFF_STATUSES.DONE,
  escalations: [],
  summary: 'Implemented the approved change.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test -- alert',
      probeStatus: PROBE_STATUSES.PASSED,
    },
  ],
  notes: [],
});

const failedHandoff = (): BuilderHandoff => ({
  version: BUILDER_HANDOFF_VERSION,
  specId,
  status: BUILDER_HANDOFF_STATUSES.FAILED,
  summary: 'The migration could not be completed.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test -- alert',
      probeStatus: PROBE_STATUSES.NOT_RUN,
    },
  ],
  failure: { reason: 'The required service is unavailable.' },
  notes: ['No product files were changed.'],
});

describe('builder handoff validation', () => {
  it.each([PROBE_STATUSES.FAILED, PROBE_STATUSES.NOT_RUN])(
    'given a passed probe and a second %s probe when a done handoff is validated then it is rejected',
    (probeStatus) => {
      const handoff = doneHandoff();
      handoff.acceptanceCriteria.push({
        id: 'AC2',
        probe: 'npm test -- alert-restart',
        probeStatus,
      });

      expect(() => assertBuilderHandoff({ handoff, specId })).toThrow(
        'Done builder handoff requires every probe to pass',
      );
    },
  );

  it('given all probes pass when a failed handoff is validated then it is rejected', () => {
    const handoff = failedHandoff();
    handoff.acceptanceCriteria[0] = {
      ...handoff.acceptanceCriteria[0],
      probeStatus: PROBE_STATUSES.PASSED,
    };

    expect(() => assertBuilderHandoff({ handoff, specId })).toThrow(
      'Failed builder handoff cannot mark every acceptance check as completed',
    );
  });

  it('given a failed handoff without acceptance criteria when validated then it is accepted', () => {
    expect(() =>
      assertBuilderHandoff({
        handoff: { ...failedHandoff(), acceptanceCriteria: [] },
        specId,
      }),
    ).not.toThrow();
  });

  it.each([
    {
      handoff: { ...doneHandoff(), version: '2.0.0' },
      message: 'Invalid builder handoff',
    },
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
  ])(
    'given invalid builder handoff data %# when validated then it is rejected',
    ({ handoff, message }) => {
      expect(() => assertBuilderHandoff({ handoff, specId })).toThrow(message);
    },
  );

  it('given a builder handoff with an invalid UTC date in its spec ID when validated then it is rejected', () => {
    expect(() =>
      assertBuilderHandoff({
        handoff: {
          ...doneHandoff(),
          specId: '20260230-143052-add-weather-alerts',
        },
        specId,
      }),
    ).toThrow('Invalid builder handoff spec ID');
  });
});
