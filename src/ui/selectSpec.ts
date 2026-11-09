/**
 * Objective: Collect an existing spec selection from the supplied identifiers.
 * Used: When the owner chooses to restart a spec during Maestro activation.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

type SelectSpecInput = {
  ui: ExtensionContext['ui'];
  choices: string[];
};

export const selectSpec = ({ ui, choices }: SelectSpecInput): Promise<string | undefined> =>
  ui.select('Restart spec', choices);
