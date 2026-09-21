import { describe, expect, it } from 'vitest';
import { type Escalation, validateEscalation } from '#artifacts/escalation.ts';

const escalation = (): Escalation => ({
  version: '1.0.0',
  specId: '20260321-143052-add-weather-alerts',
  revision: 3,
  id: 'E1',
  question: 'Which persistence strategy should be used?',
  context: 'The approved behavior has two valid implementations.',
  options: [
    {
      id: 'A',
      description: 'Store the value in the existing settings file.',
      consequences: 'The value follows the settings lifecycle.',
      nextStep: 'Implement the existing settings adapter.',
    },
    {
      id: 'B',
      description: 'Store the value in a new file.',
      consequences: 'The value has a separate lifecycle.',
      nextStep: 'Implement a new persistence adapter.',
    },
  ],
  recommendation: {
    optionId: 'A',
    reason: 'It follows the approved approach.',
  },
  resolution: null,
  notes: [],
});

describe('escalation schema', () => {
  it('accepts a valid unresolved escalation', () => {
    expect(validateEscalation(escalation())).toEqual(escalation());
  });

  it('accepts a null recommendation and a valid resolution', () => {
    expect(
      validateEscalation({
        ...escalation(),
        recommendation: null,
        resolution: {
          selectedOptionId: 'B',
          decision: 'Use option B.',
          reason: 'The owner selected separate storage.',
        },
      }),
    ).toMatchObject({ resolution: { selectedOptionId: 'B' } });
  });

  it('allows a resolution for an owner decision outside the options', () => {
    expect(
      validateEscalation({
        ...escalation(),
        resolution: {
          selectedOptionId: null,
          decision: 'Do not implement either option.',
          reason: 'The owner changed the direction.',
        },
      }),
    ).toMatchObject({ resolution: { selectedOptionId: null } });
  });

  it.each([
    {
      value: {
        ...escalation(),
        options: [...escalation().options, { ...escalation().options[0] }],
      },
      message: 'option IDs must be unique',
    },
    {
      value: {
        ...escalation(),
        recommendation: { optionId: 'missing', reason: 'It is better.' },
      },
      message: 'recommendation references unknown option',
    },
    {
      value: {
        ...escalation(),
        resolution: {
          selectedOptionId: 'missing',
          decision: 'Use it.',
          reason: 'The owner selected it.',
        },
      },
      message: 'resolution references unknown option',
    },
    { value: { ...escalation(), extra: true }, message: 'Invalid escalation' },
    {
      value: {
        ...escalation(),
        options: [{ ...escalation().options[0], extra: true }],
      },
      message: 'Invalid escalation',
    },
    {
      value: {
        ...escalation(),
        recommendation: {
          ...escalation().recommendation,
          extra: true,
        },
      },
      message: 'Invalid escalation',
    },
    {
      value: {
        ...escalation(),
        resolution: {
          selectedOptionId: 'A',
          decision: 'Use it.',
          reason: 'The owner selected it.',
          extra: true,
        },
      },
      message: 'Invalid escalation',
    },
  ])('rejects invalid data %#', ({ value, message }) => {
    expect(() => validateEscalation(value)).toThrow(message);
  });
});
