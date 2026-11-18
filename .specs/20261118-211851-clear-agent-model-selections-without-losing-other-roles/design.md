# 20261118-211851-clear-agent-model-selections-without-losing-other-roles: Clear agent model selections without losing other roles

## Decisions

Use the existing [model picker](../../src/ui/selectModel.ts) for the clear action ([REQ1](spec.md#req1-the-owner-must-be-able-to-clear-an-individual-roles-model)). Put the action above the filtered model results so search cannot hide it. This avoids a separate menu or keyboard shortcut.

## Contracts and prototypes

The picker distinguishes clearing, cancelling, and choosing a model. The clear action is not a model ID and does not enter model filtering or validation. [Agent model coordination](../../src/maestro/selectAgentModels.ts) applies the action to the draft; the [roles menu](../../src/ui/showAgentRolesSetupMenu.ts) presents the resulting state without mutating it.
