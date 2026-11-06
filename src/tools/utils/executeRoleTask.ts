/**
 * Objective: Supply bundled role guidance and its handoff tool to the shared SDK executor.
 * Used: By the three foreground run tools after preparing their workflow phase.
 */

import { readFile } from 'node:fs/promises';

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

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

type ExecuteRoleTaskInput = Pick<
  ExecuteTaskInput,
  'prompt' | 'cwd' | 'model' | 'thinkingLevel' | 'signal'
> & {
  role: WorkflowRole;
  ui: ExtensionContext['ui'];
};

export const executeRoleTask = async ({
  role,
  ui,
  ...input
}: ExecuteRoleTaskInput): Promise<void> => {
  const roleGuidance = await readFile(
    new URL(`../../../agents/${role}.md`, import.meta.url),
    'utf8',
  );

  try {
    const result = await executeTask({
      ...input,
      roleGuidance,
      additionalTools: [HANDOFF_TOOL_BY_ROLE[role]],
    });

    // Publish before protocol validation so a missing handoff still exposes the transcript.
    if (result.sessionFile) ui.notify(`Saved child session: ${result.sessionFile}`, 'info');
  } catch (error) {
    if (error instanceof TaskExecutionError && error.sessionFile) {
      ui.notify(`Saved child session: ${error.sessionFile}`, 'info');
    }

    throw error;
  }
};
