# 20261013-194407-check-pi-subagents-availability-with-ping-at-activation: Check pi-subagents availability with ping at activation

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions

Use the documented in-process event protocol: request channel `subagents:rpc:v1:request`, with `version: 1`, a unique `requestId`, and `method: "ping"`. The matching reply channel is `subagents:rpc:v1:reply:<requestId>`.

A successful reply has matching `requestId`, `version: 1`, `method: "ping"`, `success: true`, and ping data with `version: 1`. Other capability metadata does not need validation for this availability check.

The installed pi-subagents 0.78.0 handles ping directly without calling its agent executor. Evidence: `node_modules/pi-subagents/src/extension/rpc.js`, `handleRequest`, and the Extension RPC section of `node_modules/pi-subagents/skills/pi-subagents/references/management-authoring-rpc.md`.

Integrate with the existing activation path in `extensions/maestro.ts` and its environment checks. `src/maestro/checks/assertEnvironment.ts` currently imports preflight code, which does not confirm that the extension responds. Existing offline Pi sessions expose the event bus in `tests/support/pi-session.ts`, so controlled consumer checks need no upstream ping execution.
