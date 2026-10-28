# 20261013-194407-check-pi-subagents-availability-with-ping-at-activation: Check pi-subagents availability with ping at activation

> After owner approval, this specification is the contract for the builder and verifier.

## 1. Context, goals, and scope

R-06 identifies a gap in activation checks. Agent discovery can succeed even when the pi-subagents extension is not loaded in the current Pi process.

Add a quick availability check when `/maestro` turns Maestro on. The owner selected the existing pi-subagents `ping` protocol. The check must not run an agent.

### Out of scope

Child execution checks, child extension availability, configuration changes, dependency changes, and delegation recovery are excluded. A successful ping confirms only that the parent extension responds.

Do not test the pi-subagents ping implementation. That package owns its tests. Verification of this change covers Maestro's consumer behavior using controlled replies or no reply, not a live pi-subagents responder. Reuse existing tests when they already cover an acceptance criterion. Do not add duplicate tests. Every criterion still requires verification, but not a new test.

## 2. Requirements and constraints

### REQ1: Require one successful ping within the activation deadline

Activation requires a matching successful version 1 ping reply in the current Pi process, in addition to the existing activation checks. Each activation attempt that reaches the ping check sends one request and waits at most 2 seconds (2000 ms). Do not add retry code or a test dedicated to the absence of retries.

Verified by: [AC1](#ac1-a-successful-ping-permits-activation); [AC2](#ac2-no-reply-produces-the-installation-error-at-the-deadline); [AC4](#ac4-an-activation-attempt-makes-no-automatic-retry)

### REQ2: Reject ping failures with the installation error

A ping error, unsuccessful reply, invalid reply on the matching channel, or timeout prevents activation. The UI error must include: "Maestro flow requires pi-subagents installed in the Pi environment." Diagnostic details can follow this sentence. Existing non-ping activation errors retain their meaning.

Verified by: [AC2](#ac2-no-reply-produces-the-installation-error-at-the-deadline); [AC3](#ac3-a-failed-or-invalid-matching-reply-blocks-activation); [AC7](#ac7-existing-activation-checks-still-reject-invalid-environments)

### REQ3: Isolate requests and ignore late replies

A reply for another request does not satisfy the check. A late reply cannot activate Maestro after the attempt fails. A later owner activation attempt makes a fresh request.

Verified by: Not established. No matching AC or exact existing test scenario has been confirmed.

### REQ4: Keep the availability check outside agents and model requests

The check must not start an agent or make a model request. Preserve the existing UI-only activation notice and absence of activation entries in session history.

Verified by: [AC5](#ac5-activation-remains-outside-session-history); [extensions/maestro.integration.test.ts](../../extensions/maestro.integration.test.ts), scenario "given valid activation checks when Maestro is enabled and later re-enabled then its tools, instructions, and status are available without duplicate registration, automatic model calls, or new session history"

Coverage gap: The linked test checks model requests and history, but does not explicitly count agent launches.

### REQ5: Keep deactivation and existing environment checks unchanged

Turning Maestro off remains independent of availability checks. Preserve existing trust, agent discovery, configuration, and model checks. Do not change saved workflow files or product files during activation.

Verified by: [AC6](#ac6-turning-maestro-off-does-not-ping); [AC7](#ac7-existing-activation-checks-still-reject-invalid-environments)

Coverage gap: AC7 exercises trust only; the other environment checks and preservation of saved and product files are not all covered by these ACs.

## 3. Technical decisions

Use the documented in-process event protocol: request channel `subagents:rpc:v1:request`, with `version: 1`, a unique `requestId`, and `method: "ping"`. The matching reply channel is `subagents:rpc:v1:reply:<requestId>`.

A successful reply has matching `requestId`, `version: 1`, `method: "ping"`, `success: true`, and ping data with `version: 1`. Other capability metadata does not need validation for this availability check.

The installed pi-subagents 0.78.0 handles ping directly without calling its agent executor. Evidence: `node_modules/pi-subagents/src/extension/rpc.js`, `handleRequest`, and the Extension RPC section of `node_modules/pi-subagents/skills/pi-subagents/references/management-authoring-rpc.md`.

Integrate with the existing activation path in `extensions/maestro.ts` and its environment checks. `src/maestro/checks/assertEnvironment.ts` currently imports preflight code, which does not confirm that the extension responds. Existing offline Pi sessions expose the event bus in `tests/support/pi-session.ts`, so controlled consumer checks need no upstream ping execution.

## 4. Acceptance criteria

All ping examples below use controlled event replies. They check Maestro, not the upstream responder. Unless stated otherwise, Maestro starts off and all existing activation checks pass.

### AC1: A successful ping permits activation

1. Probe: Execute `/maestro` and supply a matching successful reply before the deadline.
2. Expected result: Maestro becomes active.
3. Example: A ping with ID `activation-1` receives `{ "version": 1, "requestId": "activation-1", "method": "ping", "success": true, "data": { "version": 1 } }` on `subagents:rpc:v1:reply:activation-1` after 100 ms. Maestro becomes active.

### AC2: No reply produces the installation error at the deadline

1. Probe: Execute `/maestro` with no responder and observe the configured waiting deadline.
2. Expected result: At the 2000 ms deadline, activation fails with the required installation sentence in a UI error.
3. Example: Request `activation-2` receives no reply. At 1999 ms it is still waiting. At 2000 ms it reports an error containing "Maestro flow requires pi-subagents installed in the Pi environment." and remains off.

### AC3: A failed or invalid matching reply blocks activation

1. Probe: Execute `/maestro` separately with an unsuccessful reply, a malformed reply, and an error while emitting the request.
2. Expected result: Each attempt stays off and reports the required installation sentence in a UI error.
3. Example: For request `activation-3`, supply a matching version 1 ping reply with `success: false` and error message `Unavailable`. Maestro stays off with the installation error. Repeat with `null` on the matching reply channel, then with an emission error `Bus unavailable`. Both attempts stay off with the same required sentence.

### AC4: An activation attempt makes no automatic retry

1. Probe: Inspect Maestro's activation path for request emission and failure handling. Do not write a test for this criterion.
2. Expected result: The code sends one request and contains no automatic retry path.
3. Example: The code emits request `activation-4` and reaches its timeout handler without a reply. That handler reports the error and does not emit another request.

### AC5: Activation remains outside session history

1. Probe: Compare session entries before and after successful activation and after a timed-out activation.
2. Expected result: Neither activation adds session history entries.
3. Example: A session contains three entries. Execute `/maestro` with a successful reply, turn Maestro off, and execute `/maestro` without a reply. After the timeout, the session still contains the same three entries.

### AC6: Turning Maestro off does not ping

1. Probe: Activate Maestro, remove the controlled responder, and execute `/maestro` again.
2. Expected result: The deactivation action sends zero ping requests.
3. Example: With Maestro active and no responder, execute `/maestro`. Maestro turns off and the number of ping requests from this action is zero.

### AC7: Existing activation checks still reject invalid environments

1. Probe: Execute `/maestro` in an untrusted project with a successful responder available.
2. Expected result: Maestro stays off with the existing project-trust error.
3. Example: Pi marks `/tmp/maestro-untrusted` as untrusted. Execute `/maestro` with a controlled responder ready to return success. Maestro stays off and reports an error containing "Project is not trusted".
