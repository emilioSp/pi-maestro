import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it, onTestFinished } from 'vitest';

import { hasSpecs } from '#specs/hasSpecs.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

it('given a valid spec directory among unrelated entries when checking for specs then returns true', async () => {
  const project = await createTemporaryProject();
  onTestFinished(project.cleanup);
  await mkdir(join(project.path, '20261101-100000-add-search'));
  await mkdir(join(project.path, 'notes'));
  await writeFile(join(project.path, 'README.md'), 'Notes');

  expect(await hasSpecs(project.path)).toBe(true);
});

it('given only unrelated directories and a file named like a spec when checking for specs then returns false', async () => {
  const project = await createTemporaryProject();
  onTestFinished(project.cleanup);
  await mkdir(join(project.path, 'notes'));
  await writeFile(join(project.path, '20261101-100000-add-search'), 'Not a directory');

  expect(await hasSpecs(project.path)).toBe(false);
});

it('given an empty directory when checking for specs then returns false', async () => {
  const project = await createTemporaryProject();
  onTestFinished(project.cleanup);

  expect(await hasSpecs(project.path)).toBe(false);
});

it('given an absent directory when checking for specs then returns false', async () => {
  const project = await createTemporaryProject();
  onTestFinished(project.cleanup);

  expect(await hasSpecs(join(project.path, '.specs'))).toBe(false);
});
