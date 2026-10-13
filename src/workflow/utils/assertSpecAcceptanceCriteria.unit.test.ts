import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { assertSpecAcceptanceCriteria } from '#workflow/utils/assertSpecAcceptanceCriteria.ts';

describe('assertSpecAcceptanceCriteria', () => {
  it.each([
    {
      fixture: 'two-acceptance-criteria-spec.md',
      criterionIds: ['AC1'],
      missingIds: 'AC2',
    },
    {
      fixture: 'two-acceptance-criteria-spec.md',
      criterionIds: [],
      missingIds: 'AC1, AC2',
    },
    {
      fixture: 'raw-acceptance-criterion-headings-spec.md',
      criterionIds: ['AC01'],
      missingIds: 'AC2',
    },
    {
      fixture: 'raw-acceptance-criterion-headings-spec.md',
      criterionIds: ['AC1', 'AC2'],
      missingIds: 'AC01, AC01',
    },
  ])(
    'given missing spec IDs $missingIds when the handoff is checked then the error lists those IDs',
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
      criterionIds: ['AC2', 'AC1', 'AC3'],
    },
    {
      fixture: 'raw-acceptance-criterion-headings-spec.md',
      criterionIds: ['AC01', 'AC2'],
    },
    {
      fixture: 'no-acceptance-criterion-headings-spec.md',
      criterionIds: [],
    },
  ])(
    'given $fixture with every spec ID present when the handoff is checked then it is accepted',
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
