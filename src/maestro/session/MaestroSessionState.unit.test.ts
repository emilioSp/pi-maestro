import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';
const temporaryDirectories: string[] = [];

const createSpecFile = async (contents: string): Promise<string> => {
  const directory = join('/tmp', `pi-maestro-session-${crypto.randomUUID()}`);
  temporaryDirectories.push(directory);
  await mkdir(directory, { recursive: true });

  const specPath = join(directory, 'spec.md');
  await writeFile(specPath, contents, 'utf8');

  return specPath;
};

afterEach(async () => {
  maestroSessionState.deactivate();

  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('Maestro session state', () => {
  it('returns the same inactive state instance each time', () => {
    const first = maestroSessionState;
    const second = maestroSessionState;

    expect(first).toBe(second);
    expect(first.isActive()).toBe(false);
    expect(first.getActiveSpecId()).toBeNull();
    expect(first.getSpecSha256()).toBeNull();
  });

  it('keeps the active spec and SHA only in live state', async () => {
    const state = maestroSessionState;
    const specPath = await createSpecFile('specification\n');

    state.activate();
    state.setActiveSpecId(SPEC_ID);
    await state.setSpecSha256({ specPath });

    expect(state.isActive()).toBe(true);
    expect(state.getActiveSpecId()).toBe(SPEC_ID);
    expect(state.getSpecSha256()).toBe(
      '976bb7fd4f9d42cce09fd5dad6081198da99a1f03bf39747b1f0e817b9540308',
    );

    state.clearActiveSpecId();

    expect(state.getActiveSpecId()).toBeNull();
    expect(state.getSpecSha256()).toBeNull();
  });

  it('replaces the SHA baseline when the active spec is retried', async () => {
    const state = maestroSessionState;
    const firstSpecPath = await createSpecFile('first\n');
    const secondSpecPath = await createSpecFile('second\n');

    state.activate();
    state.setActiveSpecId(SPEC_ID);
    await state.setSpecSha256({ specPath: firstSpecPath });
    await state.setSpecSha256({ specPath: secondSpecPath });

    expect(state.getSpecSha256()).not.toBe(
      '976bb7fd4f9d42cce09fd5dad6081198da99a1f03bf39747b1f0e817b9540308',
    );
  });

  it('rejects replacing the active spec with a different ID', () => {
    const state = maestroSessionState;

    state.setActiveSpecId(SPEC_ID);

    expect(() =>
      state.setActiveSpecId('20260321-143053-add-other-change'),
    ).toThrow('Cannot replace active Maestro spec');
  });

  it('rejects setting a SHA without the matching active spec', async () => {
    const state = maestroSessionState;
    const specPath = await createSpecFile('specification\n');

    await expect(state.setSpecSha256({ specPath })).rejects.toThrow(
      'without an active spec',
    );
  });

  it('deactivates the session and clears the live SHA', async () => {
    const state = maestroSessionState;
    const specPath = await createSpecFile('specification\n');

    state.activate();
    state.setActiveSpecId(SPEC_ID);
    await state.setSpecSha256({ specPath });
    state.deactivate();

    expect(state.isActive()).toBe(false);
    expect(state.getActiveSpecId()).toBeNull();
    expect(state.getSpecSha256()).toBeNull();
  });
});
