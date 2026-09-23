/**
 * Objective: Load and render the spec document template.
 * Used: When Maestro creates a new spec file.
 */

import { readFile } from 'node:fs/promises';

const TEMPLATE_URL = new URL('../../templates/spec.md', import.meta.url);

export const loadSpecTemplate = async (): Promise<string> =>
  readFile(TEMPLATE_URL, 'utf8');

export const renderSpecTemplate = ({
  template,
  specId,
  title,
}: {
  template: string;
  specId: string;
  title: string;
}): string =>
  template
    .replace('<id>', specId)
    .replace('<short, outcome-oriented title>', title.trim());
