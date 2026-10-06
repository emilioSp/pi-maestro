/**
 * Objective: Refresh Pi status from the live Maestro session and its current workflow.
 * Used: After activation, before child delegation, after main tool results, and before owner turns.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { formatMaestroStatus } from '#maestro/status/formatMaestroStatus.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';

export const MAESTRO_STATUS_KEY = 'maestro';

export const refreshMaestroStatus = async (
  context: ExtensionContext,
): Promise<void> => {
  if (!maestroSessionState.isActive()) {
    context.ui.setStatus(MAESTRO_STATUS_KEY, undefined);

    return;
  }

  const specId = maestroSessionState.getActiveSpecId();

  if (specId === null) {
    context.ui.setStatus(
      MAESTRO_STATUS_KEY,
      formatMaestroStatus({ active: true, workflow: null }),
    );

    return;
  }

  try {
    const { paths } = await resolveToolRunContext(context.cwd);

    const state = await readWorkflowState(paths.getWorkflowPath(specId));

    context.ui.setStatus(
      MAESTRO_STATUS_KEY,
      formatMaestroStatus({ active: true, workflow: { state } }),
    );
  } catch (error) {
    context.ui.setStatus(MAESTRO_STATUS_KEY, undefined);
    context.ui.notify(
      error instanceof Error ? error.message : String(error),
      'error',
    );
  }
};
