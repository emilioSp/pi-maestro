---
type: ADR
id: 'ADR-011'
title: 'Separate initial setup UI from configuration rules'
status: active
---

## Context

Initial configuration needs searchable model selection without access to Pi's private session runtime. The `owner` selected public Pi components and strict separation
between graphical controls and configuration rules.

## Decision

Use `ctx.ui.select()` for short choices and compose public `Input`, `SelectList`, and Pi filtering through `ctx.ui.custom()` for model selection. Keep graphical modules
in `src/ui/`, configuration rules and persistence in `src/config/`, and coordination in `src/maestro/setupConfiguration.ts`.

Keep completed role selections in memory for one command. Replace a role only after both nested choices finish. Configuration rules derive explicit phase flags from those
completed selections; confirmation is the only persistence boundary. Thinking choices preserve Pi's supported-level order and start at its first level for both initial
selections and replacements, without preferring `off`.

## Consequences

Setup needs no private runtime access, separate model runtime, new dependency, or persistent draft. UI components receive supplied choices rather than deciding model
requirements or phase rules. Initial setup is limited to interactive terminal mode.
