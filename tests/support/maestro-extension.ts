/**
 * Objective: Share Pi UI and tool setup for Maestro extension tests.
 * Used: When exercising Maestro alongside Pi and other registered extensions.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  AgentSession,
  ExtensionAPI,
  wrapRegisteredTool,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { vi } from 'vitest';

import { CREATE_SPEC_TOOL } from '#tools/main/create-spec.ts';
import { MARK_SPEC_READY_TOOL } from '#tools/main/mark-spec-ready.ts';
import { RESOLVE_ESCALATIONS_TOOL } from '#tools/main/resolve-escalations.ts';
import { RESOLVE_FINDINGS_TOOL } from '#tools/main/resolve-findings.ts';
import { RUN_BUILDER_TOOL } from '#tools/main/run-builder.ts';
import { RUN_SIMPLIFIER_TOOL } from '#tools/main/run-simplifier.ts';
import { RUN_VERIFIER_TOOL } from '#tools/main/run-verifier.ts';
import { SCORE_WORKFLOW_TOOL } from '#tools/main/score-workflow.ts';

export const FOREIGN_TOOL = 'foreign_tool';

export const MAIN_TOOL_NAMES = [
  CREATE_SPEC_TOOL.NAME,
  MARK_SPEC_READY_TOOL.NAME,
  RUN_BUILDER_TOOL.NAME,
  RESOLVE_ESCALATIONS_TOOL.NAME,
  RUN_VERIFIER_TOOL.NAME,
  RESOLVE_FINDINGS_TOOL.NAME,
  RUN_SIMPLIFIER_TOOL.NAME,
  SCORE_WORKFLOW_TOOL.NAME,
];

export const BASE_TOOLS = ['read', 'bash', 'edit', 'write', FOREIGN_TOOL];

export const foreignExtension = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: FOREIGN_TOOL,
    label: 'Foreign tool',
    description: 'A tool owned by another extension.',
    parameters: Type.Object({}),
    execute: async () => ({ content: [], details: undefined }),
  });
};

type RegisteredTool = ReturnType<typeof wrapRegisteredTool>;

export function assertToolRegistered(
  tool: RegisteredTool | undefined,
): asserts tool is RegisteredTool {
  if (tool === undefined) throw new Error('The tool is not active in Pi.');
}

type WriteMaestroTestConfigInput = {
  cwd: string;
  config: object;
};

// Write the exact test input without validating it or adding defaults.
export const writeMaestroTestConfig = async ({ cwd, config }: WriteMaestroTestConfigInput) => {
  const configDirectory = join(cwd, '.pi');
  const configPath = join(configDirectory, 'maestro.json');
  await mkdir(configDirectory, { recursive: true });
  await writeFile(configPath, JSON.stringify(config));

  return configPath;
};

export const chooseNewSpec = (session: AgentSession): void => {
  const ui = { ...session.extensionRunner.getUIContext() };
  vi.spyOn(ui, 'select').mockResolvedValue('New spec');
  session.extensionRunner.setUIContext(ui, 'tui');
};
