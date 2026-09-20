import { describe, expect, it } from "vitest";
import {
  MaestroConfigInputSchema,
  ResolvedMaestroConfigSchema,
  THINKING_LEVELS,
  validateConfiguration,
} from "#config/validate.ts";

describe("configuration schema validation", () => {
  it("exposes TypeBox schemas for Pi compatibility", () => {
    expect(MaestroConfigInputSchema.type).toBe("object");
    expect((MaestroConfigInputSchema as unknown as Record<string, unknown>).additionalProperties).toBe(false);
    expect(ResolvedMaestroConfigSchema.type).toBe("object");
    expect((ResolvedMaestroConfigSchema as unknown as Record<string, unknown>).additionalProperties).toBe(false);
  });

  it("accepts a full valid configuration", () => {
    const input = {
      version: "1.0.0",
      specDirectory: ".specs",
      worktreeDirectory: ".worktree",
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
    };

    expect(validateConfiguration(input)).toEqual(input);
  });

  it("accepts a minimal configuration containing only version", () => {
    const input = { version: "1.0.0" };
    expect(validateConfiguration(input)).toEqual(input);
  });

  it("accepts partial configurations with valid overrides", () => {
    const input = {
      version: "1.0.0",
      builder: {
        timeoutMinutes: 90,
      },
    };
    expect(validateConfiguration(input)).toEqual(input);
  });

  it("accepts all supported thinking levels", () => {
    for (const level of THINKING_LEVELS) {
      const input = {
        version: "1.0.0",
        builder: { thinking: level },
      };
      expect(validateConfiguration(input)).toEqual(input);
    }
  });

  it("accepts valid timeout bounds of 1 and 1440 minutes", () => {
    expect(
      validateConfiguration({
        version: "1.0.0",
        builder: { timeoutMinutes: 1 },
      }),
    ).toEqual({
      version: "1.0.0",
      builder: { timeoutMinutes: 1 },
    });

    expect(
      validateConfiguration({
        version: "1.0.0",
        verifier: { timeoutMinutes: 1440 },
      }),
    ).toEqual({
      version: "1.0.0",
      verifier: { timeoutMinutes: 1440 },
    });
  });

  it("rejects non-object root inputs", () => {
    expect(() => validateConfiguration(null)).toThrow(
      "Configuration must be a JSON object.",
    );
    expect(() => validateConfiguration("invalid")).toThrow(
      "Configuration must be a JSON object.",
    );
    expect(() => validateConfiguration([1, 2, 3])).toThrow(
      "Configuration must be a JSON object.",
    );
  });

  it("rejects configuration when version is missing", () => {
    expect(() => validateConfiguration({})).toThrow(
      "Missing configuration version. The 'version' field is required.",
    );
  });

  it("rejects configuration when version is not a string", () => {
    expect(() => validateConfiguration({ version: 1 })).toThrow(
      "Invalid configuration version: expected a string.",
    );
  });

  it("rejects invalid semantic version format", () => {
    expect(() => validateConfiguration({ version: "v1.0.0" })).toThrow(
      'Invalid configuration version: "v1.0.0". Expected a semantic version (e.g. "1.0.0").',
    );
    expect(() => validateConfiguration({ version: "1.0" })).toThrow(
      'Invalid configuration version: "1.0". Expected a semantic version (e.g. "1.0.0").',
    );
    expect(() => validateConfiguration({ version: "not-a-version" })).toThrow(
      'Invalid configuration version: "not-a-version". Expected a semantic version (e.g. "1.0.0").',
    );
  });

  it("rejects unsupported major versions", () => {
    expect(() => validateConfiguration({ version: "2.0.0" })).toThrow(
      "Unsupported configuration major version: 2. Expected major version 1.",
    );
    expect(() => validateConfiguration({ version: "0.9.0" })).toThrow(
      "Unsupported configuration major version: 0. Expected major version 1.",
    );
  });

  it("rejects unsupported minor or patch versions", () => {
    expect(() => validateConfiguration({ version: "1.1.0" })).toThrow(
      'Unsupported configuration version: "1.1.0". Supported version is 1.0.0.',
    );
    expect(() => validateConfiguration({ version: "1.0.1" })).toThrow(
      'Unsupported configuration version: "1.0.1". Supported version is 1.0.0.',
    );
  });

  it("rejects unknown field at root level", () => {
    expect(() =>
      validateConfiguration({ version: "1.0.0", unknownRoot: "test" }),
    ).toThrow('Unknown configuration field: "unknownRoot".');
  });

  it("rejects unknown field in builder configuration", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: { unknownChild: 123 },
      }),
    ).toThrow('Unknown configuration field: "builder.unknownChild".');
  });

  it("rejects unknown field in verifier configuration", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        verifier: { unknownChild: "bad" },
      }),
    ).toThrow('Unknown configuration field: "verifier.unknownChild".');
  });

  it("rejects model identifier without provider prefix", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: { model: "gpt-5.6-luna" },
      }),
    ).toThrow(
      'Invalid model identifier at "builder.model". Must use "provider/model" format.',
    );
  });

  it("rejects model identifier with empty provider or model", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: { model: "/gpt-5.6-luna" },
      }),
    ).toThrow(
      'Invalid model identifier at "builder.model". Must use "provider/model" format.',
    );

    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        verifier: { model: "openai-codex/" },
      }),
    ).toThrow(
      'Invalid model identifier at "verifier.model". Must use "provider/model" format.',
    );
  });

  it("rejects model identifier containing whitespace", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: { model: "openai codex/gpt-5.6-luna" },
      }),
    ).toThrow(
      'Invalid model identifier at "builder.model". Must use "provider/model" format.',
    );
  });

  it("rejects unsupported thinking levels", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: { thinking: "extreme" },
      }),
    ).toThrow(
      'Invalid thinking level at "builder.thinking". Allowed: off, minimal, low, medium, high, xhigh, max.',
    );
  });

  it("rejects timeout values below minimum of 1", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: { timeoutMinutes: 0 },
      }),
    ).toThrow(
      'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: { timeoutMinutes: -5 },
      }),
    ).toThrow(
      'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
  });

  it("rejects timeout values above maximum of 1440", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        verifier: { timeoutMinutes: 1441 },
      }),
    ).toThrow(
      'Invalid timeout at "verifier.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
  });

  it("rejects non-integer timeout values", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: { timeoutMinutes: 30.5 },
      }),
    ).toThrow(
      'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: { timeoutMinutes: "60" },
      }),
    ).toThrow(
      'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
  });

  it("rejects non-object builder and verifier entries", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        builder: "not-an-object",
      }),
    ).toThrow("Invalid builder configuration: expected an object.");

    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        verifier: [1, 2, 3],
      }),
    ).toThrow("Invalid verifier configuration: expected an object.");
  });

  it("rejects empty specDirectory and worktreeDirectory", () => {
    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        specDirectory: "",
      }),
    ).toThrow("Invalid specDirectory: expected a non-empty string.");

    expect(() =>
      validateConfiguration({
        version: "1.0.0",
        worktreeDirectory: "",
      }),
    ).toThrow("Invalid worktreeDirectory: expected a non-empty string.");
  });
});
