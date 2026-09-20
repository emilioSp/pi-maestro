export type FakeSubagents<Request, Result> = {
  requests: Request[];
  results: Result[];
  run: (request: Request) => Promise<Result>;
};

export const createFakeSubagents = <Request, Result>({
  fakeResponses,
}: {
  fakeResponses: Result[];
}): FakeSubagents<Request, Result> => {
  const remainingResponses = [...fakeResponses];
  const requests: Request[] = [];
  const results: Result[] = [];

  return {
    requests,
    results,
    run: async (request) => {
      if (remainingResponses.length === 0) {
        throw new Error("No fake subagent response is available.");
      }

      const response = remainingResponses.shift() as Result;
      requests.push(request);
      results.push(response);
      return response;
    },
  };
};
