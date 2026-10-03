import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolCallEventResult,
} from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it } from 'vitest';
import childExtension from '#extensions/maestro-subagent.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

type ToolCallHandler = (
  event: ToolCallEvent,
  context: ExtensionContext,
) => ToolCallEventResult | Promise<ToolCallEventResult | undefined> | undefined;

type ProtectedToolName = 'edit' | 'write';

type CreateToolCallInput = {
  path: string;
  toolName: ProtectedToolName;
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
    input: {
      edits: [{ newText: 'changed', oldText: 'approved' }],
      path,
    },
  };
};

afterEach(async () => {
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
    await mkdir(join(repository.path, 'nested'), { recursive: true });

    let registeredToolCount = 0;
    let toolCallHandler: ToolCallHandler | undefined;

    // JUSTIFICATION: The fake implements only the extension methods used by this test.
    const pi = Object.assign(Object.create(null), {
      registerTool: () => {
        registeredToolCount += 1;
      },
      on: (_event: 'tool_call', handler: ToolCallHandler) => {
        toolCallHandler = handler;

        return () => {};
      },
    }) as ExtensionAPI;

    childExtension(pi);
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    if (toolCallHandler === undefined) {
      throw new Error('Child tool call handler was not registered.');
    }

    expect(registeredToolCount).toBe(3);

    for (const toolName of ['write', 'edit'] as const) {
      await expect(
        toolCallHandler(
          createToolCall({
            path: `.specs/${SPEC_ID}/spec.md`,
            toolName,
          }),
          // JUSTIFICATION: The hook only reads cwd from this test context.
          { cwd: join(repository.path, 'nested') } as ExtensionContext,
        ),
      ).resolves.toMatchObject({
        block: true,
        reason:
          'The owner-approved spec.md cannot be changed directly during a subagent session.',
      });
    }

    await expect(
      toolCallHandler(
        createToolCall({ path: 'README.md', toolName: 'write' }),
        // JUSTIFICATION: The hook only reads cwd from this test context.
        { cwd: repository.path } as ExtensionContext,
      ),
    ).resolves.toBeUndefined();

    await expect(
      toolCallHandler(
        {
          type: 'tool_call',
          toolCallId: 'test-call',
          toolName: 'bash',
          input: { command: 'printf test' },
        },
        // JUSTIFICATION: The hook only reads cwd from this test context.
        { cwd: repository.path } as ExtensionContext,
      ),
    ).resolves.toBeUndefined();
  });
});
