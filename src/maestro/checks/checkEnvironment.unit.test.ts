import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findRepositoryRoot: vi.fn(),
  assertRepositoryTrusted: vi.fn(),
  loadConfiguration: vi.fn(),
  getMaestroPaths: vi.fn(),
  discoverActiveWorkflow: vi.fn(),
  reconcileWorkflow: vi.fn(),
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
vi.mock('#paths.ts', () => ({ getMaestroPaths: mocks.getMaestroPaths }));
vi.mock('#workflow/state/discover.ts', () => ({
  discoverActiveWorkflow: mocks.discoverActiveWorkflow,
}));
vi.mock('#workflow/state/reconcile.ts', () => ({
  reconcileWorkflow: mocks.reconcileWorkflow,
}));
vi.mock('pi-subagents/preflight', () => ({
  resolveSubagentLaunchContract: mocks.resolveSubagentLaunchContract,
}));

import { checkEnvironment } from '#maestro/checks/checkEnvironment.ts';

const CONFIG = {
  builder: { model: 'provider/builder', thinking: 'high' },
  verifier: { model: 'provider/verifier', thinking: 'medium' },
};

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
  mocks.getMaestroPaths.mockReturnValue({});
  mocks.discoverActiveWorkflow.mockResolvedValue(null);
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

  it('rejects unreadable workflow state and stops at the first issue', async () => {
    mocks.discoverActiveWorkflow.mockRejectedValue(
      new Error('invalid workflow JSON'),
    );

    await expect(
      checkEnvironment({ context: createContext() }),
    ).rejects.toThrow(
      'Maestro workflow state check failed: invalid workflow JSON',
    );
    expect(mocks.reconcileWorkflow).not.toHaveBeenCalled();
  });

  it('reports all issues for an inconsistent active workflow', async () => {
    mocks.discoverActiveWorkflow.mockResolvedValue({
      state: { specId: 'spec' },
    });
    mocks.reconcileWorkflow.mockResolvedValue({
      issues: ['branch mismatch', 'other issue'],
    });

    await expect(
      checkEnvironment({ context: createContext() }),
    ).rejects.toThrow(
      'Maestro workflow state check failed: branch mismatch\n\nother issue',
    );
  });

  it('allows a dirty base and absent configured directories without changing paths', async () => {
    const before = JSON.stringify({ root: '/repo', files: ['tracked-change'] });

    await expect(
      checkEnvironment({ context: createContext() }),
    ).resolves.toBeUndefined();

    expect(mocks.loadConfiguration).toHaveBeenCalledWith({ cwd: '/repo' });
    expect(mocks.getMaestroPaths).toHaveBeenCalledWith({
      repositoryRoot: '/repo',
      config: CONFIG,
    });
    expect(mocks.discoverActiveWorkflow).toHaveBeenCalledOnce();
    expect(JSON.stringify({ root: '/repo', files: ['tracked-change'] })).toBe(
      before,
    );
  });
});
