STATUS: TODO

# Task 27: Write the builder and verifier agents

## Dependency

This task depends on Task 26: Implement final review and cleanup.

## Objective

Define the two package agents and their complete role contracts.

## Plan references

- Sections [2.1](../plan.md#plan-section-2-1), [2.3](../plan.md#plan-section-2-3), [2.10](../plan.md#plan-section-2-10), and [3](../plan.md#plan-section-3)
- Section [5](../plan.md#plan-section-5), `agents/builder.md` and `agents/verifier.md`
- Sections [6.8](../plan.md#plan-section-6-8), [6.11](../plan.md#plan-section-6-11), [6.12](../plan.md#plan-section-6-12), and [6.19](../plan.md#plan-section-6-19)

## Work

1. Write the exact approved YAML front matter for both agents.
2. Use package `maestro`, fresh context, foreground execution, replace-mode prompts, project context inheritance, no global context, no skills, and no nested subagents.
3. Load only `../extensions/maestro-child.ts` as the child-only extension.
4. Give each role only its approved tools.
5. Explain authority, required reads, spec compliance, probe-breakage cycles, terminal handoffs, commits, and stopping conditions.
6. Tell the builder when to record observations, fail, or escalate.
7. Tell the verifier to regenerate evidence, never repair code, never decide findings, and restore every breakage.

## Implementation

Use simple, direct English. Move only generic legacy rules into these contracts. Repository commands and technical rules come from applicable `AGENTS.md` files. Do not mention old helper scripts, allowed path lists, or direct owner contact.

## Tests

Add a focused Vitest or fixture-based parser test for front matter names, package, models, thinking, context mode, timeout, extension path, and exact tool allowlists. Review the prose against the plan.

## Completion criteria

- Runtime names resolve to `maestro.builder` and `maestro.verifier`.
- Neither agent can orchestrate another agent.
- Each role has enough instruction to produce the approved repository artifacts.
