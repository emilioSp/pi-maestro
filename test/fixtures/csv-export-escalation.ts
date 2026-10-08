/**
 * Objective: Supply two unresolved CSV export questions for handoff tests.
 * Used: In tests of builder submissions, owner batches, and run results.
 */

import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoffSubmissionInput,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';

export const csvExportEscalation: Extract<
  BuilderHandoffSubmissionInput,
  { status: typeof BUILDER_HANDOFF_STATUSES.ESCALATION }
> = {
  status: BUILDER_HANDOFF_STATUSES.ESCALATION,
  summary: 'CSV export rules need owner decisions.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'CSV export check awaits owner rules.',
      probeStatus: PROBE_STATUSES.NOT_RUN,
    },
  ],
  notes: ['The contract does not define archived or deleted rows.'],
  escalations: [
    {
      id: 'E1',
      question: 'Must CSV exports include archived rows?',
      context: 'Archived rows remain stored but are not current.',
      options: [
        {
          id: 'include',
          description: 'Include archived rows.',
          consequences: 'Exports contain history.',
          nextStep: 'Export archived rows.',
        },
        {
          id: 'exclude',
          description: 'Exclude archived rows.',
          consequences: 'Exports contain current rows only.',
          nextStep: 'Filter archived rows.',
        },
      ],
      recommendation: { optionId: 'exclude', reason: 'Keep exports current.' },
      notes: [],
      resolution: null,
    },
    {
      id: 'E2',
      question: 'Must CSV exports include deleted rows?',
      context: 'Deleted rows remain stored for recovery.',
      options: [
        {
          id: 'include',
          description: 'Include deleted rows.',
          consequences: 'Exports disclose deleted data.',
          nextStep: 'Export deleted rows.',
        },
        {
          id: 'exclude',
          description: 'Exclude deleted rows.',
          consequences: 'Exports omit deleted data.',
          nextStep: 'Filter deleted rows.',
        },
      ],
      recommendation: null,
      notes: ['Deletion can indicate sensitive data.'],
      resolution: null,
    },
  ],
};
