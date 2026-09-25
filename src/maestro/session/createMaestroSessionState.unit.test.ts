import { describe, expect, it } from 'vitest';
import { createMaestroSessionState } from '#maestro/session/createMaestroSessionState.ts';

describe('Maestro session state', () => {
  it('starts inactive', () => {
    const state = createMaestroSessionState();

    expect(state.isActive()).toBe(false);
  });

  it('keeps the active spec only in the live state object', () => {
    const state = createMaestroSessionState();

    state.activate();
    state.setActiveSpecId('20260321-143052-add-weather-alerts');

    expect(state.isActive()).toBe(true);
    expect(state.getActiveSpecId()).toBe('20260321-143052-add-weather-alerts');

    state.deactivate();
    expect(state.isActive()).toBe(false);
    expect(state.getActiveSpecId()).toBeNull();
  });
});
