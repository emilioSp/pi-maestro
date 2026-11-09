/**
 * Objective: Collect a new spec action or an existing spec identifier.
 * Used: During Maestro activation when existing specs are available.
 */

import { readdir } from 'node:fs/promises';

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { selectSpec } from '#src/ui/selectSpec.ts';

export const SPEC_ACTIONS = { NEW: 'New spec', RESTART: 'Restart spec' } as const;

type ShowSpecMenuInput = {
  ui: ExtensionContext['ui'];
  specDirectory: string;
};

export const showSpecMenu = async ({
  ui,
  specDirectory,
}: ShowSpecMenuInput): Promise<string | undefined> => {
  const choice = await ui.select('Start Maestro workflow', Object.values(SPEC_ACTIONS));

  if (choice === undefined || choice === SPEC_ACTIONS.NEW) return choice;

  const entries = await readdir(specDirectory, { withFileTypes: true });

  const specIds = entries
    .filter((entry) => entry.isDirectory() && isValidSpecId(entry.name))
    .map((entry) => entry.name)
    .sort();

  return selectSpec({ ui, choices: specIds });
};
