import { describe, expect, it } from 'vitest';
import { WORKFLOW_ROLES } from '#paths.ts';
import { createFakeSubagents } from '#test/support/fake-subagents.ts';

type Request = {
  role: string;
};

type Response = {
  status: string;
};

describe('fake subagents', () => {
  it('returns responses in order and records requests and results', async () => {
    const subagents = createFakeSubagents<Request, Response>({
      fakeResponses: [
        { status: WORKFLOW_ROLES.BUILDER },
        { status: WORKFLOW_ROLES.VERIFIER },
      ],
    });

    await expect(
      subagents.run({ role: WORKFLOW_ROLES.BUILDER }),
    ).resolves.toEqual({
      status: WORKFLOW_ROLES.BUILDER,
    });
    await expect(
      subagents.run({ role: WORKFLOW_ROLES.VERIFIER }),
    ).resolves.toEqual({
      status: WORKFLOW_ROLES.VERIFIER,
    });

    expect(subagents.requests).toEqual([
      { role: WORKFLOW_ROLES.BUILDER },
      { role: WORKFLOW_ROLES.VERIFIER },
    ]);
    expect(subagents.results).toEqual([
      { status: WORKFLOW_ROLES.BUILDER },
      { status: WORKFLOW_ROLES.VERIFIER },
    ]);
  });

  it('rejects a request without a configured outcome', async () => {
    const subagents = createFakeSubagents<Request, Response>({
      fakeResponses: [],
    });

    await expect(
      subagents.run({ role: WORKFLOW_ROLES.BUILDER }),
    ).rejects.toThrow('No fake subagent response is available.');
  });
});
