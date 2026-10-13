/**
 * Objective: Supply a reportable technical problem for builder handoff tests.
 * Used: When a required compiler check cannot run during a builder pass.
 */

import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoffSubmissionInput,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';

export const unavailableCompilerEscalation: Extract<
  BuilderHandoffSubmissionInput,
  { status: typeof BUILDER_HANDOFF_STATUSES.ESCALATION }
> = {
  status: BUILDER_HANDOFF_STATUSES.ESCALATION,
  summary: 'The required compiler check cannot run.',
  acceptanceCriteria: [
    {
      id: 'AC1',
      probe: 'compiler check cannot run because the command is unavailable.',
      probeStatus: PROBE_STATUSES.NOT_RUN,
    },
  ],
  notes: [],
  escalations: [
    {
      id: 'E1',
      question: 'How must work continue without the required compiler?',
      context: 'The compiler command is unavailable.',
      options: [
        {
          id: 'restore',
          description: 'Restore the compiler and retry the required check.',
          consequences: 'The approved contract stays unchanged.',
          nextStep:
            'Start a fresh builder pass after the compiler is available.',
        },
        {
          id: 'revise',
          description: 'Revise the required check in the spec.',
          consequences: 'The revised contract requires renewed owner approval.',
          nextStep: 'Review the revised spec and reply GREEN FLAG.',
        },
      ],
      recommendation: null,
      notes: [],
      resolution: null,
    },
  ],
};
