import { afterEach, describe, expect, it } from 'vitest';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';

afterEach(() => maestroSessionState.deactivate());

describe('Maestro session state', () => {
  it('given an inactive session when its state is read then Maestro is disabled and no spec is selected', () => {
    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
  });

  it('given Maestro is active with a selected spec when the spec selection is cleared then Maestro stays active with no selected spec', () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    maestroSessionState.clearActiveSpecId();

    expect(maestroSessionState.isActive()).toBe(true);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
  });

  it('given a spec is already selected when a different spec is selected then an error prevents replacing the active spec', () => {
    maestroSessionState.setActiveSpecId(SPEC_ID);

    expect(() =>
      maestroSessionState.setActiveSpecId('20260321-143053-add-other-change'),
    ).toThrow('Cannot replace active Maestro spec');
  });
});
