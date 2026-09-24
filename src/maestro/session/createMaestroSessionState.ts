/**
 * Objective: Create in-memory activation state for one Maestro session.
 * Used: When the main extension runtime is initialized.
 */

export type MaestroSessionState = {
  isActive: () => boolean;
  activate: () => void;
  deactivate: () => void;
};

export const createMaestroSessionState = (): MaestroSessionState => {
  let active = false;

  return Object.freeze({
    isActive: (): boolean => active,
    activate: (): void => {
      active = true;
    },
    deactivate: (): void => {
      active = false;
    },
  });
};
