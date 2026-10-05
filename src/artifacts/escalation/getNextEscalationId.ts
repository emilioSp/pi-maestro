/**
 * Objective: Allocate the next escalation ID from history.
 * Used: When Maestro handles escalation artifacts.
 */

import { readEscalationHistory } from '#artifacts/escalation/readEscalationHistory.ts';

type GetNextEscalationIdInput = {
  directory: string;
  specId: string;
  currentRevision: number;
};

export const getNextEscalationId = async ({
  directory,
  specId,
  currentRevision,
}: GetNextEscalationIdInput): Promise<string> => {
  const history = await readEscalationHistory({
    directory,
    specId,
    currentRevision,
  });

  return `E${history.length + 1}`;
};
