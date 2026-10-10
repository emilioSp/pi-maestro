import { describe, expect, it } from 'vitest';
import { createSpecId } from '#ids/createSpecId.ts';

describe('createSpecId', () => {
  it('given an instant with fractional seconds when a spec ID is created then the timestamp uses UTC second precision', () => {
    const instant = Temporal.Instant.from('2026-03-21T14:30:52.987Z');

    expect(createSpecId({ title: 'Weather', instant })).toBe(
      '20260321-143052-weather',
    );
  });

  it('given an instant with a non-UTC offset when a spec ID is created then the timestamp uses UTC', () => {
    const instant = Temporal.Instant.from('2026-03-21T00:30:52+02:00');

    expect(createSpecId({ title: 'Weather', instant })).toBe(
      '20260320-223052-weather',
    );
  });

  it('given titles with punctuation, whitespace, case, and accents when spec IDs are created then their slugs are normalized', () => {
    const instant = Temporal.Instant.from('2026-03-21T14:30:52Z');

    expect(
      createSpecId({ title: '  Add Café: weather_alerts!  ', instant }),
    ).toBe('20260321-143052-add-cafe-weather-alerts');
    expect(createSpecId({ title: 'Already---a_slug', instant })).toBe(
      '20260321-143052-already-a-slug',
    );
  });

  it('given a title without a slug character when a spec ID is created then it is rejected', () => {
    expect(() =>
      createSpecId({
        title: '--- !!!',
        instant: Temporal.Instant.from('2026-03-21T14:30:52Z'),
      }),
    ).toThrow('Spec slug must contain at least one letter or number.');
  });

  it('given different UTC timestamps when spec IDs are created then deterministic IDs sort by timestamp', () => {
    const earlier = createSpecId({
      title: 'Earlier change',
      instant: Temporal.Instant.from('2026-03-21T14:30:51Z'),
    });

    const later = createSpecId({
      title: 'Later change',
      instant: Temporal.Instant.from('2026-03-21T14:30:52Z'),
    });

    expect(earlier).toBe('20260321-143051-earlier-change');
    expect(later).toBe('20260321-143052-later-change');
    expect(earlier < later).toBe(true);
  });
});
