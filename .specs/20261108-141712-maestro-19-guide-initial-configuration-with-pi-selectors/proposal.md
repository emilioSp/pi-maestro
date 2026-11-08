# MAESTRO-19: Guide initial configuration

## Problem

1. A missing configuration silently selects hard-coded models.
2. First activation fails when those models are unavailable in Pi.
3. Initial configuration currently requires manually writing JSON.

## Goal and scope

1. Guided first-use setup through Pi selectors in the interactive terminal.
2. Per-role model and thinking selection, with selected roles determining enabled phases.
3. A four-action setup screen, configuration creation, and activation in one command.
4. Clear rejection of existing configurations missing required model choices.
5. Update human configuration guidance for the new setup and model requirements. Align the MAESTRO-19 roadmap item with the agreed four-action setup and link this specification.

## Out of scope

1. Editing existing configurations through a new command.
2. Automatic repair, migration, provider login, or model substitution.
3. Changing models during an active workflow.
4. Workflow recovery or new execution engines.
5. Initial configuration through RPC or non-interactive modes.

## Required behavior

See [spec.md](spec.md). Approved selector decisions: [design.md](design.md).
