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
    'given a verifier report with a probe marked %s when validated then a finding linked to that probe is required for the report to pass validation',
    (probeStatus) => {
      const input = handoff();
      input.acceptanceCriteria.push({
        id: 'AC2',
        probe: 'npm test -- alert-restart',
        probeStatus,
      });

      expect(() => assertVerifierHandoff({ handoff: input, specId })).toThrow('requires a finding');

      input.findings = [{ ...finding(), acceptanceCriterion: 'AC2' }];
      expect(() => assertVerifierHandoff({ handoff: input, specId })).not.toThrow();
    },
  );

  it('given a verifier report with a failed probe when it includes a finding for that criterion and a separate finding without a criterion then validation succeeds', () => {
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
      scenario: 'an unsupported version',
      handoff: { ...handoff(), version: '2.0.0' },
      message: 'Invalid verifier handoff',
    },
    {
      scenario: 'duplicate acceptance criterion IDs',
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
      scenario: 'finding IDs starting at F2 instead of F1',
      handoff: { ...handoff(), findings: [{ ...finding(), id: 'F2' }] },
      message: 'finding IDs must be sequential',
    },
    {
      scenario: 'a finding linked to an absent criterion',
      handoff: {
        ...handoff(),
        findings: [{ ...finding(), acceptanceCriterion: 'AC2' }],
      },
      message: 'references unknown acceptance criterion',
    },
    {
      scenario: 'a failed probe without a related finding',
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
      scenario: 'finding confidence above 1',
      handoff: { ...handoff(), findings: [{ ...finding(), confidence: 1.1 }] },
      message: 'Invalid verifier handoff',
    },
    {
      scenario: 'a finding without evidence',
      handoff: { ...handoff(), findings: [{ ...finding(), evidence: [] }] },
      message: 'Invalid verifier handoff',
    },
    {
      scenario: 'an unknown report field',
      handoff: { ...handoff(), extra: true },
      message: 'Invalid verifier handoff',
    },
    {
      scenario: 'an unknown finding field',
      handoff: {
        ...handoff(),
        findings: [{ ...finding(), extra: true }],
      },
      message: 'Invalid verifier handoff',
    },
    {
      scenario: 'an unknown evidence field',
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
  ])(
    'given a verifier report with $scenario when validated then it is rejected with the corresponding report error',
    ({ handoff: input, message }) => {
      expect(() => assertVerifierHandoff({ handoff: input, specId })).toThrow(message);
    },
  );
});
