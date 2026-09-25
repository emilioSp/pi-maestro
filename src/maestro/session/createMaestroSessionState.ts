/**
 * Objective: Create in-memory activation state for one Maestro session.
 * Used: When the main extension runtime is initialized.
 */

export type MaestroSessionState = {
  isActive: () => boolean;
  getActiveSpecId: () => string | null;
  activate: () => void;
  setActiveSpecId: (specId: string) => void;
  clearActiveSpecId: () => void;
  deactivate: () => void;
};

export const createMaestroSessionState = (): MaestroSessionState => {
  let active = false;
  let activeSpecId: string | null = null;

  const clearActiveSpecId = (): void => {
    activeSpecId = null;
  };

  return Object.freeze({
    isActive: (): boolean => active,
    getActiveSpecId: (): string | null => activeSpecId,
    activate: (): void => {
      active = true;
    },
    setActiveSpecId: (specId: string): void => {
      activeSpecId = specId;
    },
    clearActiveSpecId,
    deactivate: (): void => {
      active = false;
      clearActiveSpecId();
    },
  });
};
