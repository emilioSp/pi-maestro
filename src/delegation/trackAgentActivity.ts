/**
 * Objective: Derive agent activity from a session event and the previous snapshot.
 * Used: During a delegated run, without mutating state or publishing progress.
 */

import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';

export type AgentActivitySnapshot = {
  activeTools: ReadonlyMap<string, string>;
  assistantText: string;
};

type TrackAgentActivityInput = {
  event: AgentSessionEvent;
  snapshot?: AgentActivitySnapshot;
};

export const trackAgentActivity = ({
  event,
  snapshot = { activeTools: new Map(), assistantText: '' },
}: TrackAgentActivityInput): AgentActivitySnapshot | undefined => {
  if (event.type === 'tool_execution_start') {
    const activeTools = new Map(snapshot.activeTools);
    activeTools.set(event.toolCallId, event.toolName);

    return { ...snapshot, activeTools };
  }

  if (event.type === 'tool_execution_end') {
    const activeTools = new Map(snapshot.activeTools);
    activeTools.delete(event.toolCallId);

    return { ...snapshot, activeTools };
  }

  if (event.type !== 'message_update' && event.type !== 'message_end') return;

  if (event.message.role !== 'assistant') return;

  const assistantText = event.message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  if (!assistantText) return;

  return { ...snapshot, assistantText };
};
