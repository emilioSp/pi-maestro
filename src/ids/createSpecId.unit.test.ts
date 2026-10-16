import { describe, expect, it } from 'vitest';
import { createSpecId } from '#ids/createSpecId.ts';

describe('createSpecId', () => {
  it('given a timestamp with fractional seconds when a spec ID is created then the ID uses UTC and drops the fractional seconds', () => {
    const instant = Temporal.Instant.from('2026-03-21T14:30:52.987Z');

    expect(createSpecId({ title: 'Weather', instant })).toBe(
      '20260321-143052-weather',
    );
  });

  it('given a timestamp with a non-UTC offset when a spec ID is created then the ID uses the equivalent UTC date and time', () => {
    const instant = Temporal.Instant.from('2026-03-21T00:30:52+02:00');

    expect(createSpecId({ title: 'Weather', instant })).toBe(
      '20260320-223052-weather',
    );
  });

  it('given titles with accents, capitals, punctuation, and spaces when spec IDs are created then the title becomes lowercase unaccented words separated by single hyphens', () => {
    const instant = Temporal.Instant.from('2026-03-21T14:30:52Z');

    expect(
      createSpecId({ title: '  Add Café: weather_alerts!  ', instant }),
    ).toBe('20260321-143052-add-cafe-weather-alerts');
    expect(createSpecId({ title: 'Already---a_slug', instant })).toBe(
      '20260321-143052-already-a-slug',
    );
  });

  it('given a title containing only punctuation and spaces when a spec ID is created then creation fails because the title has no letters or numbers', () => {
    expect(() =>
      createSpecId({
        title: '--- !!!',
        instant: Temporal.Instant.from('2026-03-21T14:30:52Z'),
      }),
    ).toThrow('Spec slug must contain at least one letter or number.');
  });

  it('given two titles with different UTC timestamps when spec IDs are created then each ID contains its timestamp and the earlier ID sorts first', () => {
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
