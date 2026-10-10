import { afterEach, describe, expect, it } from 'vitest';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';

afterEach(() => maestroSessionState.deactivate());

describe('Maestro session state', () => {
  it('given an inactive session when session state is read then no active spec is stored', () => {
    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
  });

  it('given an active spec when the selection clears then Maestro stays active without a spec', () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    maestroSessionState.clearActiveSpecId();

    expect(maestroSessionState.isActive()).toBe(true);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
  });

  it('given an active spec when a different spec ID is selected then the replacement is rejected', () => {
    maestroSessionState.setActiveSpecId(SPEC_ID);

    expect(() =>
      maestroSessionState.setActiveSpecId('20260321-143053-add-other-change'),
    ).toThrow('Cannot replace active Maestro spec');
  });
});
