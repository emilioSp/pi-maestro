import { describe, expect, it } from 'vitest';
import { createMaestroSessionState } from '#maestro/session/createMaestroSessionState.ts';

describe('Maestro session state', () => {
  it('starts inactive', () => {
    const state = createMaestroSessionState();

    expect(state.isActive()).toBe(false);
  });

  it('changes activation only in the live state object', () => {
    const state = createMaestroSessionState();

    state.activate();
    expect(state.isActive()).toBe(true);

    state.deactivate();
    expect(state.isActive()).toBe(false);
  });
});
