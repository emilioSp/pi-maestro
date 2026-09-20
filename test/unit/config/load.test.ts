import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "#config/defaults.ts";
import { loadConfiguration } from "#config/load.ts";

const fixturePath = (fileName: string): string =>
  fileURLToPath(import.meta.resolve(`#test/fixtures/config/${fileName}`));

type TestWorkspace = {
  tempDir: string;
  configPath: string;
  cleanup: () => Promise<void>;
};

const createWorkspaceWithFixture = async ({
  fixtureName,
}: {
  fixtureName: string;
}): Promise<TestWorkspace> => {
  const tempDir = await realpath(await mkdtemp(join(tmpdir(), "pi-maestro-test-")));
  const piDir = join(tempDir, ".pi");
  await mkdir(piDir, { recursive: true });
  const configPath = join(piDir, "maestro.json");
  const fixtureContent = await readFile(fixturePath(fixtureName), "utf8");
  await writeFile(configPath, fixtureContent, "utf8");

  return {
    tempDir,
    configPath,
    cleanup: async () => {
      await rm(tempDir, { force: true, recursive: true });
    },
  };
};

const createEmptyWorkspace = async (): Promise<TestWorkspace> => {
  const tempDir = await realpath(await mkdtemp(join(tmpdir(), "pi-maestro-test-")));
  return {
    tempDir,
    configPath: join(tempDir, ".pi", "maestro.json"),
    cleanup: async () => {
      await rm(tempDir, { force: true, recursive: true });
    },
  };
};

describe("configuration loading", () => {
  it("returns default configuration when file does not exist", async () => {
    const workspace = await createEmptyWorkspace();
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      const config = await loadConfiguration();
      expect(config).toEqual(DEFAULT_CONFIG);
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("loads and returns a full valid configuration", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "valid-full.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      const config = await loadConfiguration();
      expect(config).toEqual({
        version: "1.0.0",
        specDirectory: "custom-specs",
        worktreeDirectory: "custom-worktrees",
        builder: {
          model: "anthropic/claude-3-7-sonnet",
          thinking: "max",
          timeoutMinutes: 120,
        },
        verifier: {
          model: "anthropic/claude-3-5-haiku",
          thinking: "low",
          timeoutMinutes: 30,
        },
      });
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("merges partial overrides with defaults without losing sibling defaults", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "valid-partial-builder-timeout.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      const config = await loadConfiguration();
      expect(config).toEqual({
        version: "1.0.0",
        specDirectory: ".specs",
        worktreeDirectory: ".worktree",
        builder: {
          model: "openai-codex/gpt-5.6-luna",
          thinking: "high",
          timeoutMinutes: 90,
        },
        verifier: {
          model: "openai-codex/gpt-5.6-sol",
          thinking: "medium",
          timeoutMinutes: 60,
        },
      });
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("merges partial directory overrides while preserving agent defaults", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "valid-partial-directories.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      const config = await loadConfiguration();
      expect(config).toEqual({
        version: "1.0.0",
        specDirectory: "specs-dir",
        worktreeDirectory: "worktree-dir",
        builder: {
          model: "openai-codex/gpt-5.6-luna",
          thinking: "high",
          timeoutMinutes: 60,
        },
        verifier: {
          model: "openai-codex/gpt-5.6-sol",
          thinking: "medium",
          timeoutMinutes: 60,
        },
      });
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("produces an immutable configuration and does not mutate defaults", async () => {
    const initialDefaultTimeout = DEFAULT_CONFIG.builder.timeoutMinutes;
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "valid-partial-builder-timeout.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      const config = await loadConfiguration();

      expect(Object.isFrozen(config)).toBe(true);
      expect(Object.isFrozen(config.builder)).toBe(true);
      expect(Object.isFrozen(config.verifier)).toBe(true);

      const target = config as unknown as Record<string, unknown>;
      const builderTarget = config.builder as unknown as Record<string, unknown>;

      expect(() => {
        target.specDirectory = "mutated";
      }).toThrow(TypeError);

      expect(() => {
        builderTarget.timeoutMinutes = 999;
      }).toThrow(TypeError);

      expect(DEFAULT_CONFIG.builder.timeoutMinutes).toBe(initialDefaultTimeout);
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects invalid JSON with a descriptive error that includes the path", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "invalid-json.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        `Invalid JSON in configuration file "${workspace.configPath}":`,
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects configuration when version is missing", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "missing-version.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        "Missing configuration version. The 'version' field is required.",
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects configuration with invalid version format", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "invalid-version-format.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        'Invalid configuration version: "v1.0.0". Expected a semantic version (e.g. "1.0.0").',
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects configuration with unsupported major version", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "unsupported-major-version.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        "Unsupported configuration major version: 2. Expected major version 1.",
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects configuration with unsupported minor version", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "unsupported-minor-version.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        'Unsupported configuration version: "1.1.0". Supported version is 1.0.0.',
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects unknown field at root level", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "unknown-root-field.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        'Unknown configuration field: "unknownField".',
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects unknown field in builder configuration", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "unknown-builder-field.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        'Unknown configuration field: "builder.unknownOption".',
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects unknown field in verifier configuration", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "unknown-verifier-field.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        'Unknown configuration field: "verifier.unknownOption".',
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects invalid model identifier", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "invalid-model-format.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        'Invalid model identifier at "builder.model". Must use "provider/model" format.',
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects invalid thinking level", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "invalid-thinking-level.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        'Invalid thinking level at "verifier.thinking". Allowed: off, minimal, low, medium, high, xhigh, max.',
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects timeout below minimum", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "invalid-timeout-zero.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });

  it("rejects timeout above maximum", async () => {
    const workspace = await createWorkspaceWithFixture({
      fixtureName: "invalid-timeout-too-large.json",
    });
    const originalCwd = process.cwd();

    try {
      process.chdir(workspace.tempDir);
      await expect(loadConfiguration()).rejects.toThrow(
        'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
      );
    } finally {
      process.chdir(originalCwd);
      await workspace.cleanup();
    }
  });
});
