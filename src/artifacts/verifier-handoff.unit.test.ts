import { describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
  type VerifierHandoff,
  validateVerifierHandoff,
} from '#artifacts/verifier-handoff.ts';

const specId = '20260321-143052-add-weather-alerts';

const handoff = (): VerifierHandoff => ({
  version: VERIFIER_HANDOFF_VERSION,
  specId,
  revision: 6,
  summary: 'Regenerated the checks from the candidate commit.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'npm test -- alert',
      probeStatus: PROBE_STATUSES.PASSED,
      breakageStatus: BREAKAGE_STATUSES.CONFIRMED,
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
  rejection: null,
});

describe('verifier handoff schema', () => {
  it('accepts an empty finding list with completed checks', () => {
    expect(validateVerifierHandoff(handoff())).toEqual(handoff());
  });

  it('accepts findings linked to incomplete checks and other spec rules', () => {
    expect(
      validateVerifierHandoff({
        ...handoff(),
        acceptanceCriteria: [
          {
            ...handoff().acceptanceCriteria[0],
            breakageStatus: BREAKAGE_STATUSES.NOT_CONFIRMED,
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
      }),
    ).toMatchObject({ findings: [{ id: 'F1' }, { id: 'F2' }] });
  });

  it.each([
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
    expect(() => validateVerifierHandoff(input)).toThrow(message);
  });
});
