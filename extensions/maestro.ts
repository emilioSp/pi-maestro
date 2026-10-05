/**
 * Objective: Compose the Maestro extension for the owner session.
 * Used: When Pi starts a Maestro main session.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { assertEnvironment } from '#maestro/checks/assertEnvironment.ts';
import { getMaestroInstructions } from '#maestro/instructions/getMaestroInstructions.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { refreshMaestroStatus } from '#maestro/status/refreshMaestroStatus.ts';
import {
  CREATE_SPEC_TOOL,
  registerCreateSpecTool,
} from '#tools/main/create-spec.ts';
import {
  LAUNCH_BUILDER_TOOL,
  registerLaunchBuilderTool,
} from '#tools/main/launch-builder.ts';
import {
  LAUNCH_VERIFIER_TOOL,
  registerLaunchVerifierTool,
} from '#tools/main/launch-verifier.ts';
import {
  MARK_SPEC_READY_TOOL,
  registerMarkSpecReadyTool,
} from '#tools/main/mark-spec-ready.ts';
import {
  RESOLVE_ESCALATION_TOOL,
  registerResolveEscalationTool,
} from '#tools/main/resolve-escalation.ts';
import {
  RESOLVE_FINDINGS_TOOL,
  registerResolveFindingsTool,
} from '#tools/main/resolve-findings.ts';

const MAIN_TOOL_NAMES: readonly string[] = [
  CREATE_SPEC_TOOL.NAME,
  MARK_SPEC_READY_TOOL.NAME,
  LAUNCH_BUILDER_TOOL.NAME,
  RESOLVE_ESCALATION_TOOL.NAME,
  LAUNCH_VERIFIER_TOOL.NAME,
  RESOLVE_FINDINGS_TOOL.NAME,
];

export default (pi: ExtensionAPI): void => {
  registerCreateSpecTool(pi);
  registerMarkSpecReadyTool(pi);
  registerLaunchBuilderTool(pi);
  registerResolveEscalationTool(pi);
  registerLaunchVerifierTool(pi);
  registerResolveFindingsTool(pi);

  const syncMainTools = (): void => {
    const foreignTools = pi
      .getActiveTools()
      .filter((name) => !MAIN_TOOL_NAMES.includes(name));

    pi.setActiveTools(
      maestroSessionState.isActive()
        ? [...foreignTools, ...MAIN_TOOL_NAMES]
        : foreignTools,
    );
  };

  // Pi fires this when a session starts, resumes, forks, or reloads.
  // Reset Maestro to off without activation checks or startup notifications.
  pi.on('session_start', async (_event, context) => {
    maestroSessionState.deactivate();
    syncMainTools();
    await refreshMaestroStatus(context);
  });

  pi.registerCommand('maestro', {
    description: 'Turn Maestro mode on or off.',
    handler: async (_args, context) => {
      if (maestroSessionState.isActive()) {
        maestroSessionState.deactivate();
        syncMainTools();
        await refreshMaestroStatus(context);

        return;
      }

      try {
        await assertEnvironment(context);
      } catch (error) {
        context.ui.notify(
          error instanceof Error ? error.message : String(error),
          'error',
        );

        return;
      }

      maestroSessionState.activate();
      syncMainTools();
      await refreshMaestroStatus(context);
    },
  });

  // Pi fires this before the AI starts processing a user prompt.
  // Update Maestro instructions for this run and refresh the status if Maestro is on.
  pi.on('before_agent_start', async (event, context) => {
    // Pi includes named sections in the AI's system prompt. "maestro" is our section name.
    // Set or delete this section to change Maestro instructions without changing other sections.
    if (!maestroSessionState.isActive()) {
      delete event.systemPromptOptions.sections.maestro;

      return;
    }

    event.systemPromptOptions.sections.maestro = getMaestroInstructions();
    await refreshMaestroStatus(context);
  });

  // Pi fires this after a tool returns, before its result reaches the AI.
  // Refresh status after main Maestro tools, without changing the tool result.
  pi.on('tool_result', async (event, context) => {
    if (MAIN_TOOL_NAMES.includes(event.toolName)) {
      await refreshMaestroStatus(context);
    }
  });
};
