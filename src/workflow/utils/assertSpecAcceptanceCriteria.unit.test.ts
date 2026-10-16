import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { assertSpecAcceptanceCriteria } from '#workflow/utils/assertSpecAcceptanceCriteria.ts';

describe('assertSpecAcceptanceCriteria', () => {
  it.each([
    {
      fixture: 'two-acceptance-criteria-spec.md',
      scenario: 'AC1 instead of AC1 and AC2',
      criterionIds: ['AC1'],
      missingIds: 'AC2',
    },
    {
      fixture: 'two-acceptance-criteria-spec.md',
      scenario: 'no IDs instead of AC1 and AC2',
      criterionIds: [],
      missingIds: 'AC1, AC2',
    },
    {
      fixture: 'raw-acceptance-criterion-headings-spec.md',
      scenario: 'AC01 but no AC2 from raw spec headings',
      criterionIds: ['AC01'],
      missingIds: 'AC2',
    },
    {
      fixture: 'raw-acceptance-criterion-headings-spec.md',
      scenario: 'AC1 instead of repeated AC01 headings',
      criterionIds: ['AC1', 'AC2'],
      missingIds: 'AC01, AC01',
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
      ).toThrow(
        `Handoff is missing acceptance criterion IDs from spec.md: ${missingIds}.`,
      );
    },
  );

  it.each([
    {
      fixture: 'two-acceptance-criteria-spec.md',
      scenario: 'all required IDs reordered, plus AC3',
      criterionIds: ['AC2', 'AC1', 'AC3'],
    },
    {
      fixture: 'raw-acceptance-criterion-headings-spec.md',
      scenario: 'IDs from repeated and code headings',
      criterionIds: ['AC01', 'AC2'],
    },
    {
      scenario: 'no criterion headings and no report IDs',
      fixture: 'no-acceptance-criterion-headings-spec.md',
      criterionIds: [],
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
