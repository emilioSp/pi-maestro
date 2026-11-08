/**
 * Objective: Supply explicit available agent settings for offline tests.
 * Used: In scenarios with all three execution phases enabled.
 */

import type { MaestroConfig } from '#config/schema.ts';

export const TEST_CONFIG: MaestroConfig = {
  version: '1.0.0',
  specDirectory: '.specs',
  builder: { required: true, model: 'openai-codex/gpt-6.1-sol', thinking: 'high' },
  verifier: { required: true, model: 'openai-codex/gpt-6-astra', thinking: 'medium' },
  simplifier: { required: true, model: 'openai-codex/gpt-6.1-sol', thinking: 'high' },
};
