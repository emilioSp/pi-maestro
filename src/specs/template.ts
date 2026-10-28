/**
 * Objective: Load and render a required specification document from its bundled template.
 * Used: When Maestro creates the proposal and behavioral spec for a new change.
 */

import { readFile } from 'node:fs/promises';

type RenderSpecTemplateInput = {
  document: 'proposal.md' | 'spec.md';
  specId: string;
  title: string;
};

export const renderSpecTemplate = async ({
  document,
  specId,
  title,
}: RenderSpecTemplateInput): Promise<string> => {
  const template = await readFile(new URL(`../../templates/${document}`, import.meta.url), 'utf8');

  return template.replace('<id>', specId).replace('<short, outcome-oriented title>', title.trim());
};
