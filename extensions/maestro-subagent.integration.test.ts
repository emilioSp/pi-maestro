import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ToolCallEvent } from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it } from 'vitest';
import childExtension from '#extensions/maestro-subagent.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { BUILDER_ESCALATION_TOOL } from '#tools/child/open-escalation.ts';
import { BUILDER_HANDOFF_TOOL } from '#tools/child/record-builder-handoff.ts';
import { VERIFIER_HANDOFF_TOOL } from '#tools/child/record-verifier-handoff.ts';

type CreateToolCallInput = {
  path: string;
  toolName: 'edit' | 'write';
};

const SPEC_ID = '20260321-143052-add-weather-alerts';

const cleanupFunctions: Array<() => Promise<void>> = [];

const createToolCall = ({
  path,
  toolName,
}: CreateToolCallInput): ToolCallEvent => {
  if (toolName === 'write') {
    return {
      type: 'tool_call',
      toolCallId: 'test-call',
      toolName,
      input: { content: 'changed', path },
    };
  }

  return {
    type: 'tool_call',
    toolCallId: 'test-call',
    toolName,
    input: { edits: [{ newText: 'changed', oldText: 'approved' }], path },
  };
};

afterEach(async () => {
  await piTestSessions.cleanup();
  maestroSessionState.deactivate();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('subagent extension', () => {
  it('registers subagent tools once and blocks direct spec writes and edits', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    const specPath = join(repository.path, '.specs', SPEC_ID, 'spec.md');
    await mkdir(join(repository.path, '.specs', SPEC_ID), { recursive: true });
    await writeFile(specPath, '# Approved specification\n', 'utf8');
    await mkdir(join(repository.path, 'nested'));

    const { session } = await piTestSessions.create({
      cwd: join(repository.path, 'nested'),
      extensions: [childExtension],
    });

    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    expect(
      session.extensionRunner
        .getAllRegisteredTools()
        .map(({ definition }) => definition.name),
    ).toEqual([
      BUILDER_ESCALATION_TOOL.NAME,
      BUILDER_HANDOFF_TOOL.NAME,
      VERIFIER_HANDOFF_TOOL.NAME,
    ]);

    for (const toolName of ['write', 'edit'] as const) {
      await expect(
        session.extensionRunner.emitToolCall(
          createToolCall({
            path: `.specs/${SPEC_ID}/spec.md`,
            toolName,
          }),
        ),
      ).resolves.toMatchObject({
        block: true,
        reason:
          'The owner-approved spec.md cannot be changed directly during a subagent session.',
      });
    }

    await expect(
      session.extensionRunner.emitToolCall(
        createToolCall({
          path: 'README.md',
          toolName: 'write',
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      session.extensionRunner.emitToolCall({
        type: 'tool_call',
        toolCallId: 'test-call',
        toolName: 'bash',
        input: { command: 'printf test' },
      }),
    ).resolves.toBeUndefined();
  });
});
