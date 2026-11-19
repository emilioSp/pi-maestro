import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { ClassifierResult } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { afterEach, expect, it, onTestFinished, vi } from 'vitest';

import { loadConfiguration } from '#config/loadConfiguration.ts';
import { saveConfiguration } from '#config/saveConfiguration.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { collectWorkflowEvidence } from '#src/score/collectWorkflowEvidence.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import * as piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { registerScoreWorkflowTool } from '#tools/main/score-workflow.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, WORKFLOW_STATE_VERSION } from '#workflow/state/schema.ts';

const exec = promisify(execFile);

const SPEC_ID = '20260321-143052-add-weather-alerts';

const SUCCESS: ClassifierResult = {
  api: 'typesafe-system-one',
  provider: 'openrouter',
  model: 'typesafe/jev-1.14',
  answers: {
    correctness: { type: 'score', score: 3.6, confidence: 0.8 },
    verificationQuality: { type: 'score', score: 2, confidence: 0.6 },
  },
  stopReason: 'stop',
  timestamp: 1,
};

const createScoringProject = async () => {
  const project = await createTemporaryProject();
  onTestFinished(project.cleanup);
  await saveConfiguration({
    cwd: project.path,
    agentModelSelections: {
      builder: TEST_CONFIG.builder,
      verifier: TEST_CONFIG.verifier,
      simplifier: TEST_CONFIG.simplifier,
      scorer: TEST_CONFIG.scorer,
    },
  });

  const paths = new MaestroPaths({
    projectRoot: project.path,
    config: await loadConfiguration(project.path),
  });

  await mkdir(paths.getSpecPath(SPEC_ID), { recursive: true });
  await writeFile(paths.getProposalFilePath(SPEC_ID), '# CSV export motivation');
  await writeFile(paths.getSpecFilePath(SPEC_ID), '# CSV export behavior');
  await writeFile(
    paths.getWorkflowPath(SPEC_ID),
    JSON.stringify({
      version: WORKFLOW_STATE_VERSION,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.SCORER_RUNNING,
    }),
  );
  await exec('git', ['init', '-q'], { cwd: project.path });
  await writeFile(join(project.path, 'baseline'), 'initial\n');
  await exec('git', ['add', '.'], { cwd: project.path });
  await exec(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'baseline'],
    { cwd: project.path },
  );
  maestroSessionState.setActiveSpecId(SPEC_ID);

  return { project, paths };
};

const supplyClassifier = (
  session: Awaited<ReturnType<typeof piTestSessions.create>>['session'],
) => {
  const model = session.modelRuntime.getModelOfType(
    'classifier',
    'openrouter',
    'typesafe/jev-1.14',
  );

  if (!model) throw new Error('Test catalog lacks Jev.');
  vi.spyOn(session.modelRuntime, 'getModelOfType').mockReturnValue(model);

  return vi.spyOn(session.modelRuntime, 'classify');
};

afterEach(() => {
  maestroSessionState.deactivate();
});

it('GIVEN multiple passes and mixed Git edits WHEN evidence is collected THEN documents, decisions and complete untracked files retain their identities without evaluation output', async () => {
  const { project, paths } = await createScoringProject();
  await writeFile(paths.getDesignFilePath(SPEC_ID), '# Approved CSV design');
  await mkdir(join(project.path, 'src'));
  await writeFile(join(project.path, 'src/export.ts'), 'before export\n');
  await writeFile(join(project.path, 'src/escape.ts'), 'before escape\n');
  await exec('git', ['add', 'src'], { cwd: project.path });
  await exec(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'sources'],
    { cwd: project.path },
  );
  await writeFile(join(project.path, 'src/export.ts'), 'staged export\n');
  await exec('git', ['add', 'src/export.ts'], { cwd: project.path });
  await writeFile(join(project.path, 'src/escape.ts'), 'unstaged escape\n');
  await writeFile(join(project.path, 'src/evaluation.json'), '{"source": "tracked"}\n');
  await exec('git', ['add', '--', 'src/evaluation.json'], { cwd: project.path });
  await writeFile(join(project.path, 'src/evaluation.raw.json'), '{"source": "untracked"}\n');
  await writeFile(join(project.path, 'src/csv helpers.ts'), 'new helper\n');
  await writeFile(join(project.path, "src/quote ' $; helper.ts"), 'shell safe\n');

  for (const [name, content] of Object.entries({
    'builder/B1.json': { escalations: [{ id: 'E1', resolution: { decision: 'Use CSV' } }] },
    'builder/B2.json': { summary: 'Implemented CSV' },
    'verifier/V1.json': { findings: [{ id: 'F1', decision: { decision: 'fix-code' } }] },
    'verifier/V2.json': { findings: [] },
    'simplifier/S.json': { summary: 'Simplified CSV' },
  })) {
    await mkdir(join(paths.getHandoffsPath(SPEC_ID), name.split('/')[0]), { recursive: true });
    await writeFile(join(paths.getHandoffsPath(SPEC_ID), name), JSON.stringify(content));
  }

  await mkdir(join(paths.getSpecPath(SPEC_ID), 'spec-score'));
  await writeFile(
    join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json'),
    'old evaluation',
  );
  await exec(
    'git',
    ['add', '--', join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json')],
    {
      cwd: project.path,
    },
  );
  await writeFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.raw.json'), 'old raw');
  let api!: ExtensionAPI;
  await piTestSessions.createRegisteredTool({
    cwd: project.path,
    extension: (pi) => {
      api = pi;
      registerScoreWorkflowTool(pi);
    },
  });
  const evidence = await collectWorkflowEvidence({ pi: api, paths, specId: SPEC_ID });
  expect(evidence.documents).toEqual([
    { name: 'proposal.md', content: '# CSV export motivation' },
    { name: 'spec.md', content: '# CSV export behavior' },
    { name: 'design.md', content: '# Approved CSV design' },
  ]);
  expect(evidence.handoffs.map(({ name }) => name)).toEqual([
    'builder/B1.json',
    'builder/B2.json',
    'simplifier/S.json',
    'verifier/V1.json',
    'verifier/V2.json',
  ]);
  expect(evidence.handoffs[0].content).toContain('Use CSV');
  expect(evidence.handoffs[3].content).toContain('fix-code');
  expect(evidence.trackedDiff).toContain('+staged export');
  expect(evidence.trackedDiff).toContain('+unstaged escape');
  expect(evidence.untrackedFiles).toContainEqual(
    expect.objectContaining({
      name: 'src/csv helpers.ts',
      diff: expect.stringContaining('+new helper'),
    }),
  );
  expect(evidence.untrackedFiles).toContainEqual(
    expect.objectContaining({
      name: "src/quote ' $; helper.ts",
      diff: expect.stringContaining('+shell safe'),
    }),
  );
  expect(evidence.trackedDiff).toContain('+{"source": "tracked"}');
  expect(evidence.untrackedFiles).toContainEqual({
    name: 'src/evaluation.raw.json',
    diff: expect.stringContaining('+{"source": "untracked"}'),
  });
  expect(JSON.stringify(evidence)).not.toContain(`.specs/${SPEC_ID}/spec-score/evaluation.json`);
  expect(JSON.stringify(evidence)).not.toContain(
    `.specs/${SPEC_ID}/spec-score/evaluation.raw.json`,
  );
});

it.each([
  {
    label: 'fractional levels',
    response: SUCCESS,
    scores: {
      correctness: { score: 90, confidence: 0.8 },
      verificationQuality: { score: 50, confidence: 0.6 },
    },
  },
  {
    label: 'whole levels',
    response: {
      ...SUCCESS,
      answers: {
        correctness: { type: 'score' as const, score: 4, confidence: 0.9 },
        verificationQuality: { type: 'score' as const, score: 3, confidence: 0.7 },
      },
      usage: {
        input: 10,
        output: 2,
        totalTokens: 12,
        cacheRead: 0,
        cacheWrite: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    },
    scores: {
      correctness: { score: 100, confidence: 0.9 },
      verificationQuality: { score: 75, confidence: 0.7 },
    },
  },
])(
  'GIVEN old evaluation files and $label WHEN a valid response is saved THEN both files are overwritten with distinct scores and confidence before candidate-ready',
  async ({ response, scores }) => {
    const { project, paths } = await createScoringProject();
    const reportPath = join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json');
    const rawPath = join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.raw.json');
    await mkdir(join(paths.getSpecPath(SPEC_ID), 'spec-score'));
    await writeFile(reportPath, 'old report');
    await writeFile(rawPath, 'old raw');

    const { tool, session } = await piTestSessions.createRegisteredTool({
      cwd: project.path,
      extension: registerScoreWorkflowTool,
    });

    const classify = supplyClassifier(session);
    classify.mockResolvedValue(response);
    await tool.execute('score', { specId: SPEC_ID });
    expect(session.modelRuntime.getModelOfType).toHaveBeenCalledWith(
      'classifier',
      'openrouter',
      'typesafe/jev-1.14',
    );
    expect(classify).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'openrouter', id: 'typesafe/jev-1.14' }),
      expect.anything(),
      expect.anything(),
    );
    expect(JSON.parse(await readFile(rawPath, 'utf8'))).toEqual(response);
    expect(JSON.parse(await readFile(reportPath, 'utf8'))).toEqual({
      specId: SPEC_ID,
      provider: 'openrouter',
      model: 'typesafe/jev-1.14',
      scoringCriteriaVersion: '1.0.0',
      status: 'success',
      scores,
    });
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
  },
);

it.each([
  {
    label: 'Unauthorized error',
    response: { ...SUCCESS, stopReason: 'error' as const, errorMessage: 'Unauthorized' },
    reason: 'Unauthorized',
  },
  {
    label: 'out-of-range correctness',
    response: {
      ...SUCCESS,
      answers: {
        ...SUCCESS.answers,
        correctness: { type: 'score' as const, score: 5, confidence: 0.8 },
      },
    },
    reason: 'Invalid correctness score',
  },
])(
  'GIVEN $label WHEN scoring finishes THEN the failure has no scores and preserves the returned response',
  async ({ response, reason }) => {
    const { project, paths } = await createScoringProject();

    const { tool, session } = await piTestSessions.createRegisteredTool({
      cwd: project.path,
      extension: registerScoreWorkflowTool,
    });

    supplyClassifier(session).mockResolvedValue(response);
    await tool.execute('score', { specId: SPEC_ID });

    const report = JSON.parse(
      await readFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json'), 'utf8'),
    );

    expect(report).toMatchObject({ status: 'failure', reason: expect.stringContaining(reason) });
    expect(report).not.toHaveProperty('scores');
    expect(
      JSON.parse(
        await readFile(
          join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.raw.json'),
          'utf8',
        ),
      ),
    ).toEqual(response);
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
  },
);

it('GIVEN the exact classifier is missing and stale evaluation files exist WHEN scoring runs THEN a fresh failure report is saved and the old raw response is removed', async () => {
  const { project, paths } = await createScoringProject();
  const rawPath = join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.raw.json');
  await mkdir(join(paths.getSpecPath(SPEC_ID), 'spec-score'));
  await writeFile(rawPath, 'old raw');
  await writeFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json'), 'old report');

  const { tool, session } = await piTestSessions.createRegisteredTool({
    cwd: project.path,
    extension: registerScoreWorkflowTool,
  });

  vi.spyOn(session.modelRuntime, 'getModelOfType').mockReturnValue(undefined);
  const classify = vi.spyOn(session.modelRuntime, 'classify');
  await tool.execute('score', { specId: SPEC_ID });
  expect(
    JSON.parse(
      await readFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json'), 'utf8'),
    ),
  ).toEqual(
    expect.objectContaining({
      status: 'failure',
      reason: 'Exact classifier openrouter/typesafe/jev-1.14 unavailable.',
    }),
  );
  await expect(readFile(rawPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  expect(classify).not.toHaveBeenCalled();
});

it('GIVEN Git has no HEAD WHEN scoring runs THEN the saved failure identifies the missing baseline without inference or scores', async () => {
  const { project, paths } = await createScoringProject();
  await exec('git', ['update-ref', '-d', 'HEAD'], { cwd: project.path });

  const { tool, session } = await piTestSessions.createRegisteredTool({
    cwd: project.path,
    extension: registerScoreWorkflowTool,
  });

  const classify = vi.spyOn(session.modelRuntime, 'classify');
  await tool.execute('score', { specId: SPEC_ID });

  const report = JSON.parse(
    await readFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json'), 'utf8'),
  );

  expect(report).toMatchObject({
    status: 'failure',
    reason: expect.stringContaining('Git HEAD baseline unavailable'),
  });
  expect(report).not.toHaveProperty('scores');
  expect(classify).not.toHaveBeenCalled();
  await expect(
    readFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.raw.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
    phase: WORKFLOW_PHASES.CANDIDATE_READY,
  });
});

it('GIVEN truncated Git diff output WHEN scoring runs THEN incomplete evidence saves a failure without inference or scores', async () => {
  const { project, paths } = await createScoringProject();

  const { tool, session } = await piTestSessions.createRegisteredTool({
    cwd: project.path,
    extension: (pi) => {
      const originalExec = pi.exec;
      vi.spyOn(pi, 'exec').mockImplementation(async (command, args, options) =>
        args.includes('diff')
          ? { code: 1, stdout: 'partial', stderr: '', killed: true, truncated: true }
          : originalExec(command, args, options),
      );
      registerScoreWorkflowTool(pi);
    },
  });

  const classify = vi.spyOn(session.modelRuntime, 'classify');
  await tool.execute('score', { specId: SPEC_ID });

  const report = JSON.parse(
    await readFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json'), 'utf8'),
  );

  expect(report).toMatchObject({
    status: 'failure',
    reason: 'Incomplete Git evidence: output is truncated.',
  });
  expect(report).not.toHaveProperty('scores');
  expect(classify).not.toHaveBeenCalled();
  expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
    phase: WORKFLOW_PHASES.CANDIDATE_READY,
  });
});

it('GIVEN verifier-running WHEN scoring is requested THEN inference and evaluation output are rejected', async () => {
  const { project, paths } = await createScoringProject();
  await writeFile(
    paths.getWorkflowPath(SPEC_ID),
    JSON.stringify({
      version: WORKFLOW_STATE_VERSION,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    }),
  );

  const { tool, session } = await piTestSessions.createRegisteredTool({
    cwd: project.path,
    extension: registerScoreWorkflowTool,
  });

  const classify = vi.spyOn(session.modelRuntime, 'classify');
  await expect(tool.execute('score', { specId: SPEC_ID })).rejects.toThrow(
    'requires scorer-running',
  );
  expect(classify).not.toHaveBeenCalled();
  await expect(
    readFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

it('GIVEN owner cancellation during inference WHEN the request ends THEN a failure report is saved and the workflow reaches candidate-ready', async () => {
  const { project, paths } = await createScoringProject();

  const { tool, session } = await piTestSessions.createRegisteredTool({
    cwd: project.path,
    extension: registerScoreWorkflowTool,
  });

  supplyClassifier(session).mockResolvedValue({ ...SUCCESS, stopReason: 'aborted' });
  await tool.execute('score', { specId: SPEC_ID });
  expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
    phase: WORKFLOW_PHASES.CANDIDATE_READY,
  });
  expect(
    JSON.parse(
      await readFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.json'), 'utf8'),
    ),
  ).toEqual({
    specId: SPEC_ID,
    provider: 'openrouter',
    model: 'typesafe/jev-1.14',
    scoringCriteriaVersion: '1.0.0',
    status: 'failure',
    reason: 'Workflow scoring cancelled.',
  });
  await expect(
    readFile(join(paths.getSpecPath(SPEC_ID), 'spec-score', 'evaluation.raw.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

it('GIVEN a configured classifier different from the former fixed model WHEN scoring succeeds THEN lookup, invocation, and report use the configured identity', async () => {
  const { project, paths } = await createScoringProject();
  const configPath = join(project.path, '.pi/maestro.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  await writeFile(
    configPath,
    JSON.stringify({ ...config, scorer: { required: true, model: 'test-provider/custom/judge' } }),
  );

  const { tool, session } = await piTestSessions.createRegisteredTool({
    cwd: project.path,
    extension: registerScoreWorkflowTool,
  });

  const catalogModel = session.modelRuntime.getModelOfType(
    'classifier',
    'openrouter',
    'typesafe/jev-1.14',
  );

  if (!catalogModel) throw new Error('Test catalog lacks classifier.');
  const selected = { ...catalogModel, provider: 'test-provider', id: 'custom/judge' };
  const lookup = vi.spyOn(session.modelRuntime, 'getModelOfType').mockReturnValue(selected);
  const classify = vi.spyOn(session.modelRuntime, 'classify').mockResolvedValue(SUCCESS);

  await tool.execute('score', { specId: SPEC_ID });

  expect(lookup).toHaveBeenCalledWith('classifier', 'test-provider', 'custom/judge');
  expect(classify).toHaveBeenCalledWith(selected, expect.anything(), expect.anything());
  expect(
    JSON.parse(
      await readFile(join(paths.getSpecPath(SPEC_ID), 'spec-score/evaluation.json'), 'utf8'),
    ),
  ).toMatchObject({
    provider: 'test-provider',
    model: 'custom/judge',
    status: 'success',
  });
});
