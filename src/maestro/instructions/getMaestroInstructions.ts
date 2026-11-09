/**
 * Objective: Load the Maestro coordinator's operating procedure and documentation paths.
 * Used: When Pi prepares a model request while Maestro is active.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const README_PATH = fileURLToPath(new URL('../../../README.md', import.meta.url));

const DOCS_PATH = fileURLToPath(new URL('../../../docs/', import.meta.url));

const TEMPLATES_PATH = fileURLToPath(new URL('../../../templates/', import.meta.url));

export const getMaestroInstructions = async (): Promise<string> => {
  const instructions = await readFile(
    new URL('../../../agents/maestro.md', import.meta.url),
    'utf8',
  );

  return instructions
    .trimEnd()
    .replaceAll('{{README_PATH}}', () => README_PATH)
    .replaceAll('{{DOCS_PATH}}', () => DOCS_PATH)
    .replaceAll('{{TEMPLATES_PATH}}', () => TEMPLATES_PATH);
};
