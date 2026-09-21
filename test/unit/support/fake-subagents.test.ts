import { describe, expect, it } from 'vitest';
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
      fakeResponses: [{ status: 'builder' }, { status: 'verifier' }],
    });

    await expect(subagents.run({ role: 'builder' })).resolves.toEqual({
      status: 'builder',
    });
    await expect(subagents.run({ role: 'verifier' })).resolves.toEqual({
      status: 'verifier',
    });

    expect(subagents.requests).toEqual([
      { role: 'builder' },
      { role: 'verifier' },
    ]);
    expect(subagents.results).toEqual([
      { status: 'builder' },
      { status: 'verifier' },
    ]);
  });

  it('rejects a request without a configured outcome', async () => {
    const subagents = createFakeSubagents<Request, Response>({
      fakeResponses: [],
    });

    await expect(subagents.run({ role: 'builder' })).rejects.toThrow(
      'No fake subagent response is available.',
    );
  });
});
