/**
 * Objective: Display completed role choices and the setup confirmation action.
 * Used: Between role edits during first-use configuration.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import type { SetupRole, AgentModelSelections } from '#config/saveConfiguration.ts';

export const CONFIRM_SETUP = 'confirm';

const ROLE_LABELS: Record<SetupRole, string> = {
  builder: 'Builder',
  verifier: 'Verifier',
  simplifier: 'Simplifier',
};

type ShowSetupMenuInput = {
  ui: ExtensionContext['ui'];
  roles: SetupRole[];
  selections: AgentModelSelections;
};

export const showSetupMenu = async ({ ui, roles, selections }: ShowSetupMenuInput) => {
  const actions = roles.map((role) => {
    const selection = selections[role];

    return {
      role,
      label: selection
        ? `${ROLE_LABELS[role]}: ${selection.model} (${selection.thinking})`
        : `Select ${role}`,
    };
  });

  const choice = await ui.select('Maestro setup', [
    ...actions.map(({ label }) => label),
    'Confirm',
  ]);

  if (choice === 'Confirm') return CONFIRM_SETUP;

  return actions.find(({ label }) => label === choice)?.role;
};
