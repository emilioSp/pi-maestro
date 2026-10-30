/**
 * Objective: Manage activation and spec selection for one Maestro owner session.
 * Used: By the main extension and owner tools, never by child sessions.
 */

class MaestroSessionState {
  private active = false;
  private activeSpecId: string | null = null;
  private waitingForFinalResponse = false;

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
    this.stopWaitingForFinalResponse();
  };

  public setWaitingForFinalResponseMode = (specId: string): void => {
    if (this.active && this.activeSpecId === specId) {
      this.waitingForFinalResponse = true;
    }
  };

  public isWaitingForFinalResponse = (): boolean => this.waitingForFinalResponse;

  public stopWaitingForFinalResponse = (): void => {
    this.waitingForFinalResponse = false;
  };

  public clearActiveSpecId = (): void => {
    this.activeSpecId = null;
    this.stopWaitingForFinalResponse();
  };

  public deactivate = (): void => {
    this.active = false;
    this.clearActiveSpecId();
  };
}

const maestroSessionState = new MaestroSessionState();

export default maestroSessionState;
