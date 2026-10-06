import { describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
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

describe('verifier handoff validation', () => {
  it('accepts an empty finding list with completed checks', () => {
    expect(() =>
      assertVerifierHandoff({ handoff: handoff(), specId, revision: 6 }),
    ).not.toThrow();
  });

  it('given mixed confirmed and not-required breakages when all probes pass then accepts no findings', () => {
    const input = handoff();
    input.acceptanceCriteria.push({
      id: 'AC2',
      probe: 'Inspect the timestamp font size.',
      probeStatus: PROBE_STATUSES.PASSED,
      breakageStatus: BREAKAGE_STATUSES.NOT_REQUIRED,
    });

    expect(() =>
      assertVerifierHandoff({ handoff: input, specId, revision: 6 }),
    ).not.toThrow();
  });

  it.each([BREAKAGE_STATUSES.NOT_RUN, BREAKAGE_STATUSES.NOT_CONFIRMED])(
    'given a passed probe and %s breakage then requires a finding',
    (breakageStatus) => {
      const input = handoff();
      input.acceptanceCriteria[0].breakageStatus = breakageStatus;

      expect(() =>
        assertVerifierHandoff({ handoff: input, specId, revision: 6 }),
      ).toThrow('requires a finding');
    },
  );

  it.each([PROBE_STATUSES.FAILED, PROBE_STATUSES.NOT_RUN])(
    'given a %s probe without required breakage then requires a finding',
    (probeStatus) => {
      const input = handoff();
      input.acceptanceCriteria[0] = {
        ...input.acceptanceCriteria[0],
        probeStatus,
        breakageStatus: BREAKAGE_STATUSES.NOT_REQUIRED,
      };

      expect(() =>
        assertVerifierHandoff({ handoff: input, specId, revision: 6 }),
      ).toThrow('requires a finding');

      input.findings = [finding()];
      expect(() =>
        assertVerifierHandoff({ handoff: input, specId, revision: 6 }),
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
        },
        specId,
        revision: 6,
      }),
    ).not.toThrow();
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
    expect(() =>
      assertVerifierHandoff({ handoff: input, specId, revision: 6 }),
    ).toThrow(message);
  });

  it('requires the expected spec ID and revision', () => {
    expect(() =>
      assertVerifierHandoff({
        handoff: handoff(),
        specId: '20260321-143052-other-change',
        revision: 6,
      }),
    ).toThrow('Verifier handoff spec ID mismatch');

    expect(() =>
      assertVerifierHandoff({ handoff: handoff(), specId, revision: 7 }),
    ).toThrow('Verifier handoff revision mismatch');
  });
});
