import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

export const THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export const MODEL_PATTERN = "^[^/\\s]+/[^/\\s]+$";

export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const SUPPORTED_CONFIG_VERSION = "1.0.0";
export const MIN_TIMEOUT_MINUTES = 1;
export const MAX_TIMEOUT_MINUTES = 1440;

export const ThinkingSchema = Type.Union([
  Type.Literal("off"),
  Type.Literal("minimal"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("xhigh"),
  Type.Literal("max"),
]);

export const PartialAgentConfigSchema = Type.Object(
  {
    model: Type.Optional(Type.String({ pattern: MODEL_PATTERN })),
    thinking: Type.Optional(ThinkingSchema),
    timeoutMinutes: Type.Optional(
      Type.Integer({
        minimum: MIN_TIMEOUT_MINUTES,
        maximum: MAX_TIMEOUT_MINUTES,
      }),
    ),
  },
  { additionalProperties: false },
);

export const MaestroConfigInputSchema = Type.Object(
  {
    version: Type.String(),
    specDirectory: Type.Optional(Type.String({ minLength: 1 })),
    worktreeDirectory: Type.Optional(Type.String({ minLength: 1 })),
    builder: Type.Optional(PartialAgentConfigSchema),
    verifier: Type.Optional(PartialAgentConfigSchema),
  },
  { additionalProperties: false },
);

export const ResolvedAgentConfigSchema = Type.Object(
  {
    model: Type.String({ pattern: MODEL_PATTERN }),
    thinking: ThinkingSchema,
    timeoutMinutes: Type.Integer({
      minimum: MIN_TIMEOUT_MINUTES,
      maximum: MAX_TIMEOUT_MINUTES,
    }),
  },
  { additionalProperties: false },
);

export const ResolvedMaestroConfigSchema = Type.Object(
  {
    version: Type.Literal(SUPPORTED_CONFIG_VERSION),
    specDirectory: Type.String({ minLength: 1 }),
    worktreeDirectory: Type.String({ minLength: 1 }),
    builder: ResolvedAgentConfigSchema,
    verifier: ResolvedAgentConfigSchema,
  },
  { additionalProperties: false },
);

export type AgentConfig = Static<typeof ResolvedAgentConfigSchema>;
export type PartialAgentConfig = Static<typeof PartialAgentConfigSchema>;
export type MaestroConfig = Static<typeof ResolvedMaestroConfigSchema>;
export type PartialMaestroConfig = Static<typeof MaestroConfigInputSchema>;

type SchemaValidationError = {
  instancePath: string;
  schemaPath: string;
  message: string;
};

const formatError = (error: SchemaValidationError): string => {
  const path = error.instancePath.replace(/^\//, "").replace(/\//g, ".");

  if (error.schemaPath.includes("additionalProperties")) {
    return `Unknown configuration field: "${path}".`;
  }

  if (path.endsWith("thinking")) {
    return `Invalid thinking level at "${path}". Allowed: ${THINKING_LEVELS.join(", ")}.`;
  }

  if (path.endsWith("timeoutMinutes")) {
    return `Invalid timeout at "${path}". Must be an integer between ${MIN_TIMEOUT_MINUTES} and ${MAX_TIMEOUT_MINUTES}.`;
  }

  if (path.endsWith("model")) {
    return `Invalid model identifier at "${path}". Must use "provider/model" format.`;
  }

  if (path === "builder" || path === "verifier") {
    return `Invalid ${path} configuration: expected an object.`;
  }

  if (path === "specDirectory" || path === "worktreeDirectory") {
    return `Invalid ${path}: expected a non-empty string.`;
  }

  return `Invalid configuration at "${path}": ${error.message}.`;
};

export const validateConfiguration = (input: unknown): PartialMaestroConfig => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Configuration must be a JSON object.");
  }

  const raw = input as Record<string, unknown>;

  if (!("version" in raw) || raw.version === undefined) {
    throw new Error("Missing configuration version. The 'version' field is required.");
  }

  if (typeof raw.version !== "string") {
    throw new Error("Invalid configuration version: expected a string.");
  }

  const semverMatch = raw.version.match(SEMVER_PATTERN);
  if (!semverMatch) {
    throw new Error(
      `Invalid configuration version: "${raw.version}". Expected a semantic version (e.g. "1.0.0").`,
    );
  }

  const majorVersion = semverMatch[1];
  if (majorVersion !== "1") {
    throw new Error(
      `Unsupported configuration major version: ${majorVersion}. Expected major version 1.`,
    );
  }

  if (raw.version !== SUPPORTED_CONFIG_VERSION) {
    throw new Error(
      `Unsupported configuration version: "${raw.version}". Supported version is ${SUPPORTED_CONFIG_VERSION}.`,
    );
  }

  const [firstError] = Value.Errors(MaestroConfigInputSchema, raw);
  if (firstError !== undefined) {
    throw new Error(formatError(firstError));
  }

  return raw as unknown as PartialMaestroConfig;
};
