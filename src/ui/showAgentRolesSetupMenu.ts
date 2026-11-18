/**
 * Objective: Display current agent role choices and the confirmation action.
 * Used: Between role edits during first-use setup and agent model changes.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import {
  SETUP_ROLES,
  type SetupRole,
  type AgentModelSelections,
} from '#config/saveConfiguration.ts';

export const CONFIRM_SETUP = 'confirm';

const CONFIRM_LABEL = 'Confirm';

const ROLE_LABELS: Record<SetupRole, string> = {
  builder: 'Builder',
  verifier: 'Verifier',
  simplifier: 'Simplifier',
  scorer: 'Scorer',
};

type ShowAgentRolesSetupMenuInput = {
  ui: ExtensionContext['ui'];
  roles: SetupRole[];
  currentAgentsConfiguration: AgentModelSelections;
};

export const showAgentRolesSetupMenu = async ({
  ui,
  roles,
  currentAgentsConfiguration,
}: ShowAgentRolesSetupMenuInput) => {
  const specOnly = currentAgentsConfiguration.builder === undefined;

  const actions = roles.map((role) => {
    const selection = currentAgentsConfiguration[role];

    const thinking =
      role === SETUP_ROLES.SCORER ? undefined : currentAgentsConfiguration[role]?.thinking;

    const thinkingLabel = thinking === undefined ? '' : ` (${thinking})`;

    const skippedLabel =
      specOnly && role !== SETUP_ROLES.BUILDER ? ' — skipped without a Builder' : '';

    return {
      role,
      label: selection
        ? `${ROLE_LABELS[role]}: ${selection.model}${thinkingLabel}${skippedLabel}`
        : `Select ${role}`,
    };
  });

  const choice = await ui.select(specOnly ? 'Maestro setup — spec-only mode' : 'Maestro setup', [
    ...actions.map(({ label }) => label),
    CONFIRM_LABEL,
  ]);

  if (choice === CONFIRM_LABEL) return CONFIRM_SETUP;

  return actions.find(({ label }) => label === choice)?.role;
};
