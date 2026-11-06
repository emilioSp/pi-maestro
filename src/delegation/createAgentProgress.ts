/**
 * Objective: Publish elapsed run time and the latest normal assistant text through Pi's progress UI.
 * Used: During a delegated run, on assistant text events and once per second during silence.
 */

import type { AgentToolUpdateCallback } from '@earendil-works/pi-coding-agent';

type FormatProgressInput = {
  elapsedSeconds: number;
  assistantText: string;
};

const formatProgress = ({ elapsedSeconds, assistantText }: FormatProgressInput): string => {
  const elapsed = `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;
  const recentText = assistantText ? `\n\n${assistantText}` : '';

  return `Elapsed: ${elapsed}${recentText}`;
};

type CreateAgentProgressInput = {
  onUpdate?: AgentToolUpdateCallback;
};

export const createAgentProgress = ({ onUpdate }: CreateAgentProgressInput) => {
  const startedAt = performance.now();
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let latestText = '';

  const show = (assistantText: string = latestText): void => {
    if (stopped) return;

    latestText = assistantText;

    onUpdate?.({
      content: [
        {
          type: 'text',
          text: formatProgress({
            elapsedSeconds: Math.floor((performance.now() - startedAt) / 1000),
            assistantText,
          }),
        },
      ],
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
