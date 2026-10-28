# Maestro status bar and activation notice

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions and limits

Use Pi's existing `context.ui.notify` information notice from the activation command in `extensions/maestro.ts`. This keeps feedback out of saved messages and model context. Configuration resolution remains owned by `src/config/loadConfiguration.ts`.

Keep the existing status integration in `src/maestro/status/formatMaestroStatus.ts` and `src/maestro/status/refreshMaestroStatus.ts`. Use Pi's theme directly. No theme-switch handling is in scope.

Pi's default footer joins extension statuses on one line and truncates to the available terminal columns. It does not wrap. Keep that behavior. Other extension statuses share this width. For this spec, the shortened ID is `20261007-170438-update-mae...`. Its `Builder running` status needs 67 columns with the approved icon.
