/**
 * Objective: Manage the shared in-memory activation state for one Maestro session.
 * Used: By the main and child extensions in the foreground Pi runtime.
 */

import { getFileSha256 } from '#utils/getFileSha256.ts';

type SetSpecSha256Input = {
  specPath: string;
};

class MaestroSessionState {
  private active = false;
  private activeSpecId: string | null = null;
  private specSha256: string | null = null;

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

  public getSpecSha256 = (): string | null => this.specSha256;

  public setSpecSha256 = async ({
    specPath,
  }: SetSpecSha256Input): Promise<void> => {
    if (this.activeSpecId === null) {
      throw new Error('Cannot set spec SHA-256 without an active spec.');
    }

    this.specSha256 = await getFileSha256({ path: specPath });
  };

  public activate = (): void => {
    this.active = true;
  };

  public clearActiveSpecId = (): void => {
    this.activeSpecId = null;
    this.specSha256 = null;
  };

  public deactivate = (): void => {
    this.active = false;
    this.clearActiveSpecId();
  };
}

const maestroSessionState = new MaestroSessionState();

export default maestroSessionState;
