# MAESTRO-19: Guide initial configuration

Initial configuration setup is limited to Pi's interactive terminal mode.

## Requirements

### REQ1: Maestro MUST open setup when project configuration is absent

Delta: modified

Entry point: `/maestro` while inactive in Pi's interactive terminal mode. The initial screen has four actions: select builder, select verifier, select simplifier, and confirm.

Verified by: [AC1](#ac1-first-use-shows-four-actions)

#### AC1: First use shows four actions

GIVEN: A trusted project in interactive Pi has no `.pi/maestro.json`.
WHEN: The owner executes `/maestro`.
THEN: Maestro displays actions for builder selection, verifier selection, simplifier selection, and confirmation.
Example: In `/work/app`, the initial screen offers `Select builder`, `Select verifier`, `Select simplifier`, and `Confirm`.

### REQ2: Maestro MUST require explicit models only for enabled execution phases

Delta: modified

1. No hard-coded model defaults or implicit fallback to Pi's current model.
2. An existing configuration missing a required model produces an error without opening setup or modifying the file.
3. Disabled execution phases require no model selection or model availability check.
4. Setup uses `.specs` as the document directory and explicitly writes phase flags according to REQ9. It offers no separate directory or phase customization.

Verified by: [AC2](#ac2-missing-enabled-model-blocks-activation), [AC3](#ac3-disabled-model-can-be-omitted)

#### AC2: Missing enabled model blocks activation

GIVEN: An existing configuration enables all phases but omits the verifier model.
WHEN: The owner executes `/maestro`.
THEN: Maestro remains inactive and reports missing `verifier.model` without opening setup or modifying the file.
Example: Version `1.0.0` supplies builder and simplifier models but no verifier model; activation reports the missing verifier model and preserves the file.

#### AC3: Disabled model can be omitted

GIVEN: An existing configuration enables builder with an available model and disables verifier and simplifier without supplying their models.
WHEN: The owner executes `/maestro`.
THEN: Maestro activates without requiring either disabled role's model.
Example: Builder has `provider-a/model-a`; verifier and simplifier each have only `required: false`; activation succeeds.

### REQ3: Maestro MUST display each selected role's model and thinking on the setup screen

Delta: added

Selecting a role opens model selection followed by thinking selection. After completing both choices, the setup screen displays that role's selected values. Selecting an already configured role repeats this flow to replace its choices. Setup offers no action to clear a completed role selection. Escape in either nested selector returns to the four-action screen and discards only the pending change; the role's previous completed selection, if any, is retained.

Verified by: [AC4](#ac4-role-selection-updates-its-action), [AC5](#ac5-cancelling-a-replacement-preserves-the-previous-selection), [AC6](#ac6-cancelling-a-new-selection-leaves-the-role-unselected)

#### AC4: Role selection updates its action

GIVEN: The initial setup screen is open.
WHEN: The owner selects `provider-a/model-a` and `high` for builder.
THEN: The setup screen shows builder with `provider-a/model-a (high)`.
Example: Completing builder selection changes its displayed action to `Builder: provider-a/model-a (high)`.

#### AC5: Cancelling a replacement preserves the previous selection

GIVEN: Builder has a completed selection of `provider-a/model-a (high)`.
WHEN: The owner reopens builder selection, chooses `provider-b/model-b`, then presses Escape in the thinking selector.
THEN: The four-action screen still shows builder `provider-a/model-a (high)`.
Example: Cancelling before completing the replacement thinking discards model B and retains the complete model A selection.

#### AC6: Cancelling a new selection leaves the role unselected

GIVEN: Verifier has no completed selection.
WHEN: The owner opens verifier selection and presses Escape in either the model or thinking selector.
THEN: The four-action screen shows verifier as unselected.
Example: Selecting `provider-b/model-b` and then cancelling its thinking selector returns to the main screen without enabling verifier.

### REQ4: Maestro MUST provide searchable model selection using Pi's available catalog

Delta: added

1. Choices come from Pi's available model registry.
2. The list supports search, bounded display, keyboard navigation, selection, and cancellation through Pi's public UI components.
3. Agent model selection does not change the main conversation's model.

Verified by: [AC7](#ac7-search-filters-available-models), [AC8](#ac8-long-lists-remain-navigable), [AC9](#ac9-agent-selection-preserves-the-main-model)

#### AC7: Search filters available models

GIVEN: Pi reports `provider-a/model-a` and `provider-b/model-b` as available.
WHEN: The owner searches for `model-b`.
THEN: Only `provider-b/model-b` remains selectable.
Example: Typing `model-b` excludes `provider-a/model-a` from the filtered list.

#### AC8: Long lists remain navigable

GIVEN: Available models exceed the selector's visible row limit.
WHEN: The owner navigates to the final entry.
THEN: That entry becomes visible and selectable within the bounded list.
Example: With 30 available models, navigation reaches the final model without displaying all 30 entries at once.

#### AC9: Agent selection preserves the main model

GIVEN: Pi's main conversation uses `provider-a/model-a`.
WHEN: The owner selects `provider-b/model-b` for verifier.
THEN: Pi's main conversation still uses `provider-a/model-a`.
Example: Verifier displays `provider-b/model-b` while Pi's active conversation model remains `provider-a/model-a`.

### REQ5: Maestro MUST wait for the setup screen's confirmation before saving

Delta: added

The four-action screen is the confirmation surface: selected model and thinking values are visible before saving. Escape on this screen cancels the entire setup, discards its pending selections, leaves the configuration file absent, and keeps Maestro inactive.

Verified by: [AC10](#ac10-selections-do-not-save-before-confirmation), [AC11](#ac11-escape-on-the-main-screen-cancels-setup)

#### AC10: Selections do not save before confirmation

Verification: Manual only. Do not add an automated test for this criterion.

GIVEN: The owner has selected builder and verifier on the setup screen.
WHEN: Maestro displays their selections before the owner chooses Confirm.
THEN: No project configuration file has been written.
Example: Builder shows `provider-a/model-a (high)` and verifier shows `provider-b/model-b (medium)`; `/work/app/.pi/maestro.json` remains absent.

#### AC11: Escape on the main screen cancels setup

GIVEN: The four-action setup screen is open with unsaved role selections.
WHEN: The owner presses Escape on that screen.
THEN: Setup closes without creating `.pi/maestro.json` or activating Maestro.
Example: After selecting builder `provider-a/model-a (high)`, Escape on the main screen discards that pending setup and leaves the project configuration absent.

### REQ6: Maestro MUST save confirmed setup and activate in the same command

Delta: added

Successful saving and configuration validation precede activation. No second `/maestro` invocation is required.

Verified by: [AC12](#ac12-confirmation-saves-and-activates)

#### AC12: Confirmation saves and activates

GIVEN: A trusted, writable project has builder selected with an available model and supported thinking.
WHEN: The owner chooses Confirm.
THEN: Maestro creates `.pi/maestro.json` with those choices and activates during the original command.
Example: Confirming builder `provider-a/model-a (high)` creates the project configuration and shows active Maestro status.

### REQ7: Maestro MUST offer thinking levels supported by each selected model

Delta: added

Model and thinking are selected independently for each role. Each thinking selector preserves the supported-level order returned by Pi and initially highlights the first level in that order, both for initial selections and replacements. There is no preference for `off`; the owner confirms the desired level. Models without reasoning support offer only `off`.

Verified by: [AC13](#ac13-thinking-choices-match-model-capabilities), [AC14](#ac14-thinking-selection-starts-at-pis-first-supported-level)

#### AC13: Thinking choices match model capabilities

GIVEN: The owner selects a model whose supported thinking levels are reported by Pi.
WHEN: Setup opens that role's thinking selector.
THEN: Its selectable levels exactly match the levels supported by that model.
Example: A model supporting `off`, `low`, and `high` offers exactly those three levels. A model without reasoning support offers only `off`.

#### AC14: Thinking selection starts at Pi's first supported level

GIVEN: The owner has selected a model and Pi reports its supported thinking levels in a defined order.
WHEN: Its thinking selector opens for an initial selection or a replacement.
THEN: The initial highlighted choice is the first level in Pi's returned order, without prioritizing `off` or preserving the role's previous thinking.
Example: Pi returns `minimal, low, medium, high` for the selected model; both initial selection and replacement of a role previously using `high` start at `minimal`. If Pi returns `low, off, high`, the selector starts at `low`, not `off`.

### REQ9: Maestro MUST derive saved phase flags from completed role selections

Delta: added

On confirmation, selected roles have `required: true`; unselected roles have `required: false`. No separate phase toggle is offered. Selecting verifier or simplifier without builder does not block confirmation or trigger automatic correction of the chosen flags.

Verified by: [AC15](#ac15-only-selected-roles-are-required), [AC16](#ac16-verifier-without-builder-is-saved), [AC17](#ac17-no-role-selection-enables-spec-only-mode)

#### AC15: Only selected roles are required

GIVEN: Setup has completed builder and verifier selections but no simplifier selection.
WHEN: The owner chooses Confirm.
THEN: Saved builder and verifier flags are `true`, and the simplifier flag is `false`.
Example: Selecting builder `provider-a/model-a (high)` and verifier `provider-b/model-b (medium)` saves builder and verifier as required and simplifier as not required.

#### AC16: Verifier without builder is saved

GIVEN: Setup has a completed verifier selection and no builder or simplifier selection.
WHEN: The owner chooses Confirm.
THEN: Maestro saves builder `required: false`, verifier `required: true` with its selected model and thinking, and simplifier `required: false`, without blocking confirmation or correcting the flags.
Example: Selecting only verifier `provider-b/model-b (medium)` saves precisely that selection with builder disabled.

#### AC17: No role selection enables spec-only mode

GIVEN: The setup screen has no selected roles.
WHEN: The owner chooses Confirm.
THEN: Maestro saves all three phase flags as `required: false` and activates in spec-only mode without requiring model or thinking selections.
Example: Choosing Confirm immediately saves builder, verifier, and simplifier as not required; the owner can prepare and approve a spec without agent execution.

## Assumptions

1. The project configuration can be saved successfully. Dedicated save-failure handling and concurrent configuration creation are outside this change's scope.
2. Pi has an available model catalog. Dedicated handling for an environment without available models is outside this change's scope.
