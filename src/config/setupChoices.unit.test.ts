/**
 * Objective: Check that setup exposes Pi's exact model thinking capabilities.
 * Used: When model catalogs are transformed for the selectors.
 */

import type { Api, Model } from '@earendil-works/pi-ai';
import { expect, it } from 'vitest';

import { setupChoices } from '#config/setupChoices.ts';

const reasoningModel: Model<Api> = {
  provider: 'provider-a',
  id: 'model-a',
  name: 'Model A',
  api: 'openai-completions',
  baseUrl: 'http://127.0.0.1:1',
  reasoning: true,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 4096,
  maxTokens: 1024,
  thinkingLevelMap: { minimal: null, medium: null, low: 'low', high: 'high' },
};

it('given reasoning and non-reasoning models when setup choices are derived then thinking levels match Pi capabilities exactly', () => {
  expect(
    setupChoices([
      reasoningModel,
      { ...reasoningModel, provider: 'provider-b', id: 'model-b', reasoning: false },
      { ...reasoningModel, id: 'model-c', thinkingLevelMap: { off: null } },
    ]),
  ).toEqual([
    { value: 'provider-a/model-a', thinkingLevels: ['off', 'low', 'high'] },
    { value: 'provider-b/model-b', thinkingLevels: ['off'] },
    { value: 'provider-a/model-c', thinkingLevels: ['minimal', 'low', 'medium', 'high'] },
  ]);
});
