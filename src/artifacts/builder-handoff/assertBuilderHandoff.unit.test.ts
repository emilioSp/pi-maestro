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

describe('builder handoff validation', () => {
  it.each([PROBE_STATUSES.FAILED, PROBE_STATUSES.NOT_RUN])(
    'given a done builder report with one passed probe and another marked %s when validated then it is rejected because every probe must pass',
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

  it.each([
    {
      scenario: 'an unsupported version',
      handoff: { ...doneHandoff(), version: '2.0.0' },
      message: 'Invalid builder handoff',
    },
    {
      scenario: 'duplicate acceptance criterion IDs',
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
      scenario: 'an unknown probe status',
      handoff: {
        ...doneHandoff(),
        acceptanceCriteria: [{ ...doneHandoff().acceptanceCriteria[0], probeStatus: 'unknown' }],
      },
      message: 'Invalid builder handoff',
    },
    {
      scenario: 'an empty summary',
      handoff: { ...doneHandoff(), summary: '' },
      message: 'Invalid builder handoff',
    },
    {
      scenario: 'an unknown report field',
      handoff: { ...doneHandoff(), extra: true },
      message: 'Invalid builder handoff',
    },
    {
      scenario: 'an unknown acceptance criterion field',
      handoff: {
        ...doneHandoff(),
        acceptanceCriteria: [{ ...doneHandoff().acceptanceCriteria[0], extra: true }],
      },
      message: 'Invalid builder handoff',
    },
  ])(
    'given a builder report with $scenario when validated then it is rejected with the corresponding report error',
    ({ handoff, message }) => {
      expect(() => assertBuilderHandoff({ handoff, specId })).toThrow(message);
    },
  );

  it('given a builder report whose spec ID contains February 30 when validated then it is rejected with an invalid spec ID error', () => {
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
