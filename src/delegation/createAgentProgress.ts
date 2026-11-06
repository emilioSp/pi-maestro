/**
 * Objective: Publish agent activity and elapsed time through Pi's standard progress UI.
 * Used: During a delegated run, on relevant events and once per second during silence.
 */

import type { AgentToolUpdateCallback } from '@earendil-works/pi-coding-agent';

import type { AgentActivitySnapshot } from '#src/delegation/trackAgentActivity.ts';
import type { WorkflowRole } from '#workflow/roles.ts';

type FormatProgressInput = {
  role: WorkflowRole;
  startedAt: number;
  activity: AgentActivitySnapshot;
};

const formatProgress = ({ role, startedAt, activity }: FormatProgressInput): string => {
  const seconds = Math.floor((performance.now() - startedAt) / 1000);
  const label = role[0].toUpperCase() + role.slice(1);
  const elapsed = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const tools = [...activity.activeTools.values()].join(', ') || 'none';
  const recentText = activity.assistantText ? `\n\n${activity.assistantText}` : '';

  return `${label} | Elapsed: ${elapsed} | Active tool: ${tools}${recentText}`;
};

type CreateAgentProgressInput = {
  role: WorkflowRole;
  onUpdate?: AgentToolUpdateCallback;
};

export const createAgentProgress = ({ role, onUpdate }: CreateAgentProgressInput) => {
  const startedAt = performance.now();
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let latestActivity: AgentActivitySnapshot = { activeTools: new Map(), assistantText: '' };

  const show = (activity: AgentActivitySnapshot = latestActivity): void => {
    if (stopped) return;

    latestActivity = activity;

    onUpdate?.({
      content: [{ type: 'text', text: formatProgress({ role, startedAt, activity }) }],
      details: undefined,
    });
  };

  const startShow = (): void => {
    timer = setInterval(show, 1000);
    show();
  };

  const stopShow = (): void => {
    stopped = true;
    clearInterval(timer);
  };

  return { startShow, show, stopShow };
};
