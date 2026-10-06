/**
 * Objective: Manage activation and spec selection for one Maestro owner session.
 * Used: By the main extension and owner tools, never by child sessions.
 */

class MaestroSessionState {
  private active = false;
  private activeSpecId: string | null = null;

  public isActive = (): boolean => this.active;

  public getActiveSpecId = (): string | null => this.activeSpecId;

  public setActiveSpecId = (specId: string): void => {
    if (this.activeSpecId !== null && this.activeSpecId !== specId) {
      throw new Error(
        `Cannot replace active Maestro spec "${this.activeSpecId}" with "${specId}".`,
      );
    }

    this.activeSpecId = specId;
  };

  public activate = (): void => {
    this.active = true;
  };

  public clearActiveSpecId = (): void => {
    this.activeSpecId = null;
  };

  public deactivate = (): void => {
    this.active = false;
    this.clearActiveSpecId();
  };
}

const maestroSessionState = new MaestroSessionState();

export default maestroSessionState;
