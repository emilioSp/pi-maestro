/**
 * Objective: Compose the Maestro extension for builder and verifier subagent sessions.
 * Used: When Pi starts a Maestro subagent session.
 */

import type {
  ExtensionAPI,
  ToolCallEvent,
  ToolCallEventResult,
} from '@earendil-works/pi-coding-agent';
import { isToolCallEventType } from '@earendil-works/pi-coding-agent';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { registerOpenEscalationTool } from '#tools/child/open-escalation.ts';
import { registerRecordBuilderHandoffTool } from '#tools/child/record-builder-handoff.ts';
import { registerRecordVerifierHandoffTool } from '#tools/child/record-verifier-handoff.ts';
import { isProtectedSpecPath } from '#tools/child/utils/isProtectedSpecPath.ts';
import { resolveWorkflowContext } from '#tools/child/utils/resolveWorkflowContext.ts';

type ProtectSpecPathInput = {
  cwd: string;
  event: ToolCallEvent;
};

const getWriteOrEditPath = (event: ToolCallEvent): string | undefined => {
  if (isToolCallEventType('write', event)) {
    return event.input.path;
  }

  if (isToolCallEventType('edit', event)) {
    return event.input.path;
  }

  return undefined;
};

const protectSpecPath = async ({
  cwd,
  event,
}: ProtectSpecPathInput): Promise<ToolCallEventResult | undefined> => {
  const targetPath = getWriteOrEditPath(event);

  if (targetPath === undefined) {
    return undefined;
  }

  const specId = maestroSessionState.getActiveSpecId();

  if (specId === null) {
    return undefined;
  }

  const { paths, repositoryRoot } = await resolveWorkflowContext({
    cwd,
    specId,
  });

  const specPath = paths.getSpecFilePath(specId);

  if (
    await isProtectedSpecPath({
      repositoryRoot,
      specPath,
      targetPath,
    })
  ) {
    return {
      block: true,
      reason:
        'The owner-approved spec.md cannot be changed directly during a subagent session.',
    };
  }

  return undefined;
};

export default (pi: ExtensionAPI): void => {
  // pi-subagents selects active tools from each agent's tools allowlist after registration.
  // Child sessions have no Maestro mode toggle, so setActiveTools() is not needed here.
  registerOpenEscalationTool(pi);
  registerRecordBuilderHandoffTool(pi);
  registerRecordVerifierHandoffTool(pi);

  // Pi fires this before a tool runs. A handler can block the call.
  // Block direct child writes and edits to the owner-approved spec.md.
  pi.on('tool_call', (event, context) =>
    protectSpecPath({ cwd: context.cwd, event }),
  );
};
