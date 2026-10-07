# Maestro status bar and activation notice

## 1. Context, goals, and scope

The owner needs a compact status bar with phase icons and theme colors. Agent settings appear at activation, not in the status bar.

This change concerns status presentation and activation feedback. It does not change agent execution settings, workflow phases, spec identifiers, or artifact paths.

## 2. Requirements and constraints

### Activation notice

After each successful `/maestro` activation, show one theme-colored UI-only information notice with three lines:

```text
Maestro active
Builder (<model name> <thinking level>)
Verifier (<model name> <thinking level>)
```

Use resolved project configuration at activation, including defaults for omitted settings. Omit each model's provider prefix. These are configured settings, not a report of a running agent.

The notice does not start an AI response, enter model context, or persist in session history. Do not show it on deactivation, failed activation, status refresh, or session start. Existing activation errors remain unchanged.

### Status content

Keep the existing status structure, with a shortened ID and phase icon:

```text
Maestro active · <shortened spec ID> · <phase icon> <existing phase label>
```

Keep the original `YYYYMMDD-HHMMSS` prefix. Retain at most 10 characters from the title portion. Hyphens and digits count toward this limit. Append `...` only if characters were removed. Shorten only the status display. Keep full identifiers everywhere else.

Do not include agent model or thinking details in the status. With no selected spec, keep `Maestro active · No active spec` without a phase icon. Hide the status when Maestro is off.

### Theme colors

Use Pi theme roles, not fixed colors:

| Status segment | Theme role |
| --- | --- |
| `Maestro active`, spec ID, and separators | `muted` |
| Ordinary phase labels and `No active spec` | `accent` |
| `escalation-decision` and `findings-decision` labels | `warning` |
| `builder-failed` label | `error` |
| `candidate-ready` label | `success` |

Emoji appearance remains controlled by the terminal.

Use Pi's active theme when formatting the status. Theme switching is Pi's responsibility. Do not add a theme-change handler or another refresh mechanism.

### Phase icons

Prefix each existing phase label with its approved icon and one space. Keep the phase labels unchanged.

| Phase | Existing label | Icon name | Unicode code point |
| --- | --- | --- | --- |
| drafting-spec | Preparing specification | Memo | U+1F4DD |
| ready-for-builder | Ready for builder | Construction | U+1F6A7 |
| builder-running | Builder running | Hammer and wrench | U+1F6E0 U+FE0F |
| escalation-decision | Owner decision needed: escalation | Raised hand | U+270B |
| builder-failed | Builder failed | Cross mark | U+274C |
| ready-for-verifier | Ready for verifier | Clipboard | U+1F4CB |
| verifier-running | Verifier running | Magnifying glass tilted left | U+1F50D |
| findings-decision | Owner decision needed: findings | Speech balloon | U+1F4AC |
| candidate-ready | Completed | Check mark button | U+2705 |

### Test coverage constraint

DO NOT ADD NEW TESTS TO COVER AC ALREADY COVERED.

Reuse existing coverage. Update existing expectations when this change alters the expected output. Add tests only for behavior not already covered.

## 3. Technical decisions and limits

Use Pi's existing `context.ui.notify` information notice from the activation command in `extensions/maestro.ts`. This keeps feedback out of saved messages and model context. Configuration resolution remains owned by `src/config/loadConfiguration.ts`.

Keep the existing status integration in `src/maestro/status/formatMaestroStatus.ts` and `src/maestro/status/refreshMaestroStatus.ts`. Use Pi's theme directly. No theme-switch handling is in scope.

Pi's default footer joins extension statuses on one line and truncates to the available terminal columns. It does not wrap. Keep that behavior. Other extension statuses share this width. For this spec, the shortened ID is `20261007-170438-update-mae...`. Its `Builder running` status needs 67 columns with the approved icon.

## 4. Acceptance criteria

### AC1: Each phase label has its approved icon

1. Probe: With Maestro active and a selected spec, observe the status in all nine phases.
2. Expected result: Each phase segment matches its entry in the icon table, with one space between the icon and label.
3. Example: Spec `20250101-000000-status-test` is in `builder-running`. Refresh the status. Its phase segment is the hammer and wrench icon (U+1F6E0 U+FE0F), one space, and `Builder running`.

### AC2: Successful activation displays the configured agent settings

1. Probe: With Maestro off, activate it in a valid project. Cover explicit settings and configuration with omitted agent settings.
2. Expected result: One information notice has the three defined lines, using the resolved builder and verifier settings.
3. Example: Builder uses `openai-codex/gpt-6.1-sol` with `xhigh`; verifier uses the same model with `high`. Run `/maestro`. The notice text is exactly `Maestro active\nBuilder (gpt-6.1-sol xhigh)\nVerifier (gpt-6.1-sol high)`.

### AC3: Activation feedback does not enter session history

1. Probe: Activate Maestro successfully, then inspect the saved session entries.
2. Expected result: The activation notice is absent from saved session history.
3. Example: Activate with builder `gpt-6.1-sol xhigh` and verifier `gpt-6.1-sol high`. No saved message or custom entry contains the three-line activation notice.

### AC4: Activation feedback does not start an AI response

1. Probe: Activate Maestro successfully while idle and observe model requests.
2. Expected result: The command starts no model request.
3. Example: With zero model requests in an idle session, run `/maestro` successfully. The request count remains zero.

### AC5: Reactivation shows the notice again

1. Probe: In one Pi session, start with Maestro off and valid activation checks. Run `/maestro` three times.
2. Expected result: The third call activates Maestro and shows a fresh activation notice, just like the first call. The notice is not limited to once per session.
3. Example: The first call turns Maestro on and shows one notice. The second turns Maestro off and shows no notice. The third turns Maestro on and shows the notice again. The cumulative activation notice counts after these calls are exactly 1, 1, and 2.

### AC6: Long spec IDs have a shortened display

1. Probe: With Maestro active, select a spec whose title portion exceeds 10 characters. Observe the status.
2. Expected result: Its displayed ID retains the date and time, the first 10 title characters, and `...`.
3. Example: Select `20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons`. Its ID segment is exactly `20261007-170438-update-mae...`.

### AC7: Short spec IDs have no cut marker

1. Probe: With Maestro active, select specs with title portions shorter than 10 characters and exactly 10 characters.
2. Expected result: Each displayed ID is unchanged, without appended `...`.
3. Example: Select `20250101-000000-fix`, then `20250101-000000-status-fix`. Their ID segments remain exactly `20250101-000000-fix` and `20250101-000000-status-fix`.

### AC8: Status colors use the approved theme roles

1. Probe: Observe the status without a selected spec and in every phase under themes with distinct role colors.
2. Expected result: Each text segment uses the role in the theme table, not a fixed color.
3. Example: A theme assigns `muted` gray, `accent` blue, `warning` amber, `error` red, and `success` green. In `builder-failed`, the prefix, ID, and separators are gray and `Builder failed` is red. In `candidate-ready`, `Completed` is green.

### AC9: Maestro off has no status entry

1. Probe: Observe the status after session start and after deactivation.
2. Expected result: The Maestro status entry is absent.
3. Example: Activate successfully, then run `/maestro` again. The `maestro` status entry is cleared.

### AC10: Activation without a selected spec preserves the existing status text

1. Probe: Activate Maestro successfully before creating a spec. Observe the status.
2. Expected result: The visible status text is exactly `Maestro active · No active spec`.
3. Example: Start with Maestro off and no selected spec. Run `/maestro`. The status is `Maestro active · No active spec`, without an icon or agent settings.

### AC11: The activation notice does not enter model context

1. Probe: Activate successfully, then inspect the context for the next owner prompt.
2. Expected result: The activation notice is absent from model context.
3. Example: Activate with builder `gpt-6.1-sol xhigh` and verifier `gpt-6.1-sol high`. Submit `Summarize the project`. Its model context contains no three-line activation notice.

### AC12: Display shortening preserves the workflow's full spec ID

1. Probe: Create a spec with a long title and observe its saved identity and status display.
2. Expected result: Only the status uses the shortened ID; workflow identity and artifact paths retain the full ID.
3. Example: Create `20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons`. The status ID segment is `20261007-170438-update-mae...`, but workflow `specId` and the spec directory retain the full ID.
