import { describe, expect, it } from 'vitest';
import { PROBE_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
  type VerifierHandoff,
} from '#artifacts/verifier-handoff/schema.ts';

const specId = '20260321-143052-add-weather-alerts';

const handoff = (): VerifierHandoff => ({
  version: VERIFIER_HANDOFF_VERSION,
  specId,
  summary: 'Regenerated the checks from the live project.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test -- alert',
      probeStatus: PROBE_STATUSES.PASSED,
    },
  ],
  findings: [],
  notes: [],
});

const finding = (): VerifierHandoff['findings'][number] => ({
  id: 'F1',
  acceptanceCriterion: 'AC1',
  severity: FINDING_SEVERITIES.HIGH,
  confidence: 0.95,
  summary: 'The alert is not persisted after restart.',
  evidence: [
    {
      source: 'npm test -- alert-restart',
      observation: 'The restored alert list was empty.',
    },
  ],
  decision: null,
});

describe('verifier handoff validation', () => {
  it.each([PROBE_STATUSES.FAILED, PROBE_STATUSES.NOT_RUN])(
    'given a passed probe and a second %s probe then requires a related finding',
    (probeStatus) => {
      const input = handoff();
      input.acceptanceCriteria.push({
        id: 'AC2',
        probe: 'npm test -- alert-restart',
        probeStatus,
      });

      expect(() => assertVerifierHandoff({ handoff: input, specId })).toThrow(
        'requires a finding',
      );

      input.findings = [{ ...finding(), acceptanceCriterion: 'AC2' }];
      expect(() =>
        assertVerifierHandoff({ handoff: input, specId }),
      ).not.toThrow();
    },
  );

  it('accepts findings linked to incomplete checks and other spec rules', () => {
    expect(() =>
      assertVerifierHandoff({
        handoff: {
          ...handoff(),
          acceptanceCriteria: [
            {
              ...handoff().acceptanceCriteria[0],
              probeStatus: PROBE_STATUSES.FAILED,
            },
          ],
          findings: [
            finding(),
            {
              ...finding(),
              id: 'F2',
              acceptanceCriterion: null,
              summary: 'The required log redaction is missing.',
            },
          ],
        },
        specId,
      }),
    ).not.toThrow();
  });

  it.each([
    {
      handoff: { ...handoff(), version: '2.0.0' },
      message: 'Invalid verifier handoff',
    },
    {
      handoff: {
        ...handoff(),
        acceptanceCriteria: [
          ...handoff().acceptanceCriteria,
          { ...handoff().acceptanceCriteria[0] },
        ],
      },
      message: 'acceptance criterion IDs must be unique',
    },
    {
      handoff: { ...handoff(), findings: [{ ...finding(), id: 'F2' }] },
      message: 'finding IDs must be sequential',
    },
    {
      handoff: {
        ...handoff(),
        findings: [{ ...finding(), acceptanceCriterion: 'AC2' }],
      },
      message: 'references unknown acceptance criterion',
    },
    {
      handoff: {
        ...handoff(),
        acceptanceCriteria: [
          {
            ...handoff().acceptanceCriteria[0],
            probeStatus: PROBE_STATUSES.FAILED,
          },
        ],
      },
      message: 'requires a finding',
    },
    {
      handoff: { ...handoff(), findings: [{ ...finding(), confidence: 1.1 }] },
      message: 'Invalid verifier handoff',
    },
    {
      handoff: { ...handoff(), findings: [{ ...finding(), evidence: [] }] },
      message: 'Invalid verifier handoff',
    },
    {
      handoff: { ...handoff(), extra: true },
      message: 'Invalid verifier handoff',
    },
    {
      handoff: {
        ...handoff(),
        findings: [{ ...finding(), extra: true }],
      },
      message: 'Invalid verifier handoff',
    },
    {
      handoff: {
        ...handoff(),
        findings: [
          {
            ...finding(),
            evidence: [{ ...finding().evidence[0], extra: true }],
          },
        ],
      },
      message: 'Invalid verifier handoff',
    },
  ])('rejects invalid handoff data %#', ({ handoff: input, message }) => {
    expect(() => assertVerifierHandoff({ handoff: input, specId })).toThrow(
      message,
    );
  });
});
