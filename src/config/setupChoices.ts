/**
 * Objective: Derive setup model and thinking choices from Pi's catalog.
 * Used: Before showing the initial configuration selectors.
 */

import type { Api, Model } from '@earendil-works/pi-ai';
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai/models';

import type { ThinkingLevel } from '#config/schema.ts';

export type SetupModelChoice = {
  value: string;
  thinkingLevels: ThinkingLevel[];
};

export const setupChoices = (models: Model<Api>[]): SetupModelChoice[] =>
  models.map((model) => ({
    value: `${model.provider}/${model.id}`,
    thinkingLevels: getSupportedThinkingLevels(model),
  }));
