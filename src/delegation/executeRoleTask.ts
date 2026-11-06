/**
 * Objective: Run a bundled SDK role with its handoff tool and UI-only live activity.
 * Used: By the three foreground run tools after preparing their workflow phase.
 */

import { readFile } from 'node:fs/promises';

import type {
  AgentSessionEvent,
  AgentToolUpdateCallback,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';

import { createAgentProgress } from '#src/delegation/createAgentProgress.ts';
import { executeTask, type ExecuteTaskInput } from '#src/delegation/executeTask.ts';
import { TaskExecutionError } from '#src/delegation/TaskExecutionError.ts';
import { recordBuilderHandoffTool } from '#tools/child/record-builder-handoff.ts';
import { recordSimplifierHandoffTool } from '#tools/child/record-simplifier-handoff.ts';
import { recordVerifierHandoffTool } from '#tools/child/record-verifier-handoff.ts';
import { WORKFLOW_ROLES, type WorkflowRole } from '#workflow/roles.ts';

const HANDOFF_TOOL_BY_ROLE = {
  [WORKFLOW_ROLES.BUILDER]: recordBuilderHandoffTool,
  [WORKFLOW_ROLES.VERIFIER]: recordVerifierHandoffTool,
  [WORKFLOW_ROLES.SIMPLIFIER]: recordSimplifierHandoffTool,
} as const;

const readAssistantText = (event: AgentSessionEvent): string => {
  if (event.type !== 'message_update' && event.type !== 'message_end') return '';

  if (event.message.role !== 'assistant') return '';

  return event.message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
};

type ExecuteRoleTaskInput = Pick<
  ExecuteTaskInput,
  'prompt' | 'cwd' | 'model' | 'thinkingLevel' | 'signal'
> & {
  role: WorkflowRole;
  ui: ExtensionContext['ui'];
  onUpdate?: AgentToolUpdateCallback;
};

export const executeRoleTask = async ({
  role,
  ui,
  onUpdate,
  prompt,
  cwd,
  model,
  thinkingLevel,
  signal,
}: ExecuteRoleTaskInput): Promise<void> => {
  const roleGuidance = await readFile(new URL(`../../agents/${role}.md`, import.meta.url), 'utf8');

  const agentProgress = createAgentProgress({ onUpdate });

  try {
    agentProgress.startShow();
    signal?.addEventListener('abort', agentProgress.stopShow, { once: true });

    if (signal?.aborted) agentProgress.stopShow();

    const result = await executeTask({
      prompt,
      cwd,
      model,
      thinkingLevel,
      signal,
      roleGuidance,
      additionalTools: [HANDOFF_TOOL_BY_ROLE[role]],
      onEvent: (event) => {
        const assistantText = readAssistantText(event);

        if (assistantText) agentProgress.show(assistantText);
      },
    });

    // Publish before protocol validation so a missing handoff still exposes the transcript.
    if (result.sessionFile) ui.notify(`Saved child session: ${result.sessionFile}`, 'info');
  } catch (error) {
    if (error instanceof TaskExecutionError && error.sessionFile) {
      ui.notify(`Saved child session: ${error.sessionFile}`, 'info');
    }

    throw error;
  } finally {
    agentProgress.stopShow();
    signal?.removeEventListener('abort', agentProgress.stopShow);
  }
};
