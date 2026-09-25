import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findRepositoryRoot: vi.fn(),
  assertRepositoryTrusted: vi.fn(),
  loadConfiguration: vi.fn(),
  resolveSubagentLaunchContract: vi.fn(),
}));

vi.mock('#git/repository/findRepositoryRoot.ts', () => ({
  findRepositoryRoot: mocks.findRepositoryRoot,
}));
vi.mock('#git/repository/assertRepositoryTrusted.ts', () => ({
  assertRepositoryTrusted: mocks.assertRepositoryTrusted,
}));
vi.mock('#config/loadConfiguration.ts', () => ({
  loadConfiguration: mocks.loadConfiguration,
}));
vi.mock('pi-subagents/preflight', () => ({
  resolveSubagentLaunchContract: mocks.resolveSubagentLaunchContract,
}));

import { checkEnvironment } from '#maestro/checks/checkEnvironment.ts';

const CONFIG = {
  builder: { model: 'provider/builder', thinking: 'high' },
  verifier: { model: 'provider/verifier', thinking: 'medium' },
};

const EXPECTED_AGENTS = {
  BUILDER: 'maestro.builder',
  VERIFIER: 'maestro.verifier',
} as const;

const createContext = (trusted = true) =>
  ({
    cwd: '/repo',
    isProjectTrusted: () => trusted,
    modelRegistry: {
      getAvailable: () => [
        { provider: 'provider', id: 'builder' },
        { provider: 'provider', id: 'verifier' },
      ],
    },
  }) as never;

const setSuccessfulChecks = (): void => {
  mocks.findRepositoryRoot.mockResolvedValue('/repo');
  mocks.assertRepositoryTrusted.mockResolvedValue(undefined);
  mocks.loadConfiguration.mockResolvedValue(CONFIG);
  mocks.resolveSubagentLaunchContract.mockResolvedValue({ ok: true });
};

describe('checkEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSuccessfulChecks();
  });

  it('checks Git availability and trust first', async () => {
    mocks.findRepositoryRoot.mockRejectedValue(new Error('not a repository'));

    await expect(
      checkEnvironment({ context: createContext() }),
    ).rejects.toThrow('Git repository check failed: not a repository');
    expect(mocks.assertRepositoryTrusted).not.toHaveBeenCalled();
  });

  it('rejects an untrusted project', async () => {
    await expect(
      checkEnvironment({ context: createContext(false) }),
    ).rejects.toThrow('Project is not trusted: "/repo".');
    expect(mocks.loadConfiguration).not.toHaveBeenCalled();
  });

  it('rejects a missing builder or verifier preflight agent', async () => {
    mocks.resolveSubagentLaunchContract.mockResolvedValue({
      ok: false,
      message: 'Agent not found',
    });

    await expect(
      checkEnvironment({ context: createContext() }),
    ).rejects.toThrow(
      'Builder or verifier agent check failed: Agent not found',
    );
    expect(mocks.resolveSubagentLaunchContract).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid configuration', async () => {
    mocks.loadConfiguration.mockRejectedValue(new Error('bad config'));

    await expect(
      checkEnvironment({ context: createContext() }),
    ).rejects.toThrow('Maestro configuration check failed: bad config');
    expect(mocks.resolveSubagentLaunchContract).toHaveBeenCalledTimes(2);
  });

  it('reports the exact unavailable model', async () => {
    mocks.loadConfiguration.mockResolvedValue({
      ...CONFIG,
      builder: { model: 'provider/missing', thinking: 'high' },
    });

    await expect(
      checkEnvironment({ context: createContext() }),
    ).rejects.toThrow('Configured model is not available: "provider/missing".');
    expect(mocks.resolveSubagentLaunchContract).toHaveBeenCalledTimes(2);
  });

  it('allows a dirty base and absent configured directories without changing paths', async () => {
    const before = JSON.stringify({ root: '/repo', files: ['tracked-change'] });

    await expect(
      checkEnvironment({ context: createContext() }),
    ).resolves.toBeUndefined();

    expect(mocks.resolveSubagentLaunchContract).toHaveBeenNthCalledWith(1, {
      agent: EXPECTED_AGENTS.BUILDER,
      cwd: '/repo',
      context: 'fresh',
    });
    expect(mocks.resolveSubagentLaunchContract).toHaveBeenNthCalledWith(2, {
      agent: EXPECTED_AGENTS.VERIFIER,
      cwd: '/repo',
      context: 'fresh',
    });
    expect(mocks.loadConfiguration).toHaveBeenCalledWith({ cwd: '/repo' });
    expect(JSON.stringify({ root: '/repo', files: ['tracked-change'] })).toBe(
      before,
    );
  });
});
