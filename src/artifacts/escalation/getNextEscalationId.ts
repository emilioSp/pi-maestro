/**
 * Objective: Allocate the next escalation ID from history.
 * Used: When Maestro handles escalation artifacts.
 * Entrypoint: getNextEscalationId().
 */

import { readEscalationHistory } from '#artifacts/escalation/readEscalationHistory.ts';

export const getNextEscalationId = async ({
  directory,
  specId,
  currentRevision,
}: {
  directory: string;
  specId: string;
  currentRevision: number;
}): Promise<string> => {
  const history = await readEscalationHistory({
    directory,
    specId,
    currentRevision,
  });
  return `E${history.length + 1}`;
};
