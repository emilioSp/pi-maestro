/**
 * Objective: Allocate the next escalation ID from history.
 * Used: When Maestro handles escalation artifacts.
 */

import { readEscalationHistory } from '#artifacts/escalation/readEscalationHistory.ts';

type GetNextEscalationIdInput = {
  directory: string;
  specId: string;
};

export const getNextEscalationId = async ({
  directory,
  specId,
}: GetNextEscalationIdInput): Promise<string> => {
  const history = await readEscalationHistory({
    directory,
    specId,
  });

  return `E${Number(history.at(-1)?.id.slice(1) ?? 0) + 1}`;
};
