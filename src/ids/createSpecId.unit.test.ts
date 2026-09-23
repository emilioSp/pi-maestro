import { describe, expect, it } from 'vitest';
import { createSpecId } from '#ids/createSpecId.ts';

describe('createSpecId', () => {
  it('formats an instant in UTC to second precision', () => {
    const instant = Temporal.Instant.from('2026-03-21T14:30:52.987Z');

    expect(createSpecId({ title: 'Weather', instant })).toBe(
      '20260321-143052-weather',
    );
  });

  it('uses UTC rather than the local time zone', () => {
    const instant = Temporal.Instant.from('2026-03-21T00:30:52+02:00');

    expect(createSpecId({ title: 'Weather', instant })).toBe(
      '20260320-223052-weather',
    );
  });

  it('normalizes title punctuation, whitespace, case, and accents', () => {
    const instant = Temporal.Instant.from('2026-03-21T14:30:52Z');

    expect(
      createSpecId({ title: '  Add Café: weather_alerts!  ', instant }),
    ).toBe('20260321-143052-add-cafe-weather-alerts');
    expect(createSpecId({ title: 'Already---a_slug', instant })).toBe(
      '20260321-143052-already-a-slug',
    );
  });

  it('rejects a title without a slug character', () => {
    expect(() =>
      createSpecId({
        title: '--- !!!',
        instant: Temporal.Instant.from('2026-03-21T14:30:52Z'),
      }),
    ).toThrow('Spec slug must contain at least one letter or number.');
  });

  it('composes deterministic IDs that sort by UTC timestamp', () => {
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
