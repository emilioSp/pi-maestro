import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { assertSpecAcceptanceCriteria } from '#workflow/utils/assertSpecAcceptanceCriteria.ts';

describe('assertSpecAcceptanceCriteria', () => {
  it.each([
    {
      fixture: 'two-acceptance-criteria-spec.md',
      scenario: 'nested AC1 but no standalone regression AC2',
      criterionIds: ['AC1'],
      missingIds: 'AC2',
    },
    {
      fixture: 'two-acceptance-criteria-spec.md',
      scenario: 'no IDs from a mixed nested and standalone spec',
      criterionIds: [],
      missingIds: 'AC1, AC2',
    },
  ])(
    'given a handoff containing $scenario when criterion coverage is checked then an error lists missing IDs $missingIds',
    async ({ fixture, criterionIds, missingIds }) => {
      const markdown = await readFile(
        new URL(`../../../tests/fixtures/${fixture}`, import.meta.url),
        'utf8',
      );

      expect(() =>
        assertSpecAcceptanceCriteria({
          markdown,
          criterionIds: new Set(criterionIds),
        }),
      ).toThrow(`Handoff is missing acceptance criterion IDs from spec.md: ${missingIds}.`);
    },
  );

  it.each([
    {
      fixture: 'two-acceptance-criteria-spec.md',
      scenario: 'all required IDs reordered, plus AC3',
      criterionIds: ['AC2', 'AC1', 'AC3'],
    },
  ])(
    'given $scenario when handoff criterion coverage is checked then validation succeeds',
    async ({ fixture, criterionIds }) => {
      const markdown = await readFile(
        new URL(`../../../tests/fixtures/${fixture}`, import.meta.url),
        'utf8',
      );

      expect(() =>
        assertSpecAcceptanceCriteria({
          markdown,
          criterionIds: new Set(criterionIds),
        }),
      ).not.toThrow();
    },
  );
});
