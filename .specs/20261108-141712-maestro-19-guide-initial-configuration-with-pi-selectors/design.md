# MAESTRO-19: Initial configuration selectors

## Decisions

1. Use `ctx.ui.select()` for short setup choices.
2. Compose a model picker from public Pi `Input` and `SelectList` components through `ctx.ui.custom()`. Use `ctx.modelRegistry.getAvailable()` for available models.
3. Reuse Pi's theme, filtering, navigation, and list rendering instead of rebuilding terminal controls.
4. Do not access private runtime state or create a separate model runtime to reuse `ModelSelectorComponent`.
5. Use Pi's public `getSupportedThinkingLevels(model)` to populate thinking choices in the returned order, without sorting or prioritizing `off`. The selector initially highlights the first supplied choice, as defined in [REQ7](spec.md#req7-maestro-must-offer-thinking-levels-supported-by-each-selected-model).
6. Keep UI and configuration business rules strictly separate. Place dedicated graphical component modules in the new `src/ui/` directory and configuration business-logic modules under `src/config/`.
7. UI modules display supplied choices, collect owner actions, and return selections or cancellation. They do not decide phase flags, model requirements, supported thinking levels, configuration defaults, validation, or persistence.
8. Configuration modules determine choices and apply configuration rules, transformations, validation, and persistence. They do not import `src/ui/`, render components, or invoke Pi UI dialogs. Keep pure rules and transformations independent of side effects.
9. Place setup orchestration in `src/maestro/setupConfiguration.ts`. It obtains choices from `src/config/`, invokes components from `src/ui/`, and passes completed selections to `src/config/` for configuration construction and saving. It contains no duplicated business rules. No dependency-injection framework or shared UI/business abstraction is needed.
10. `extensions/maestro.ts` invokes the setup orchestrator when project configuration is absent, then handles activation.
11. Keep setup state in memory for the duration of a single invocation. UI components own transient presentation state, such as search text, highlighted rows, and scroll position. The orchestrator owns completed per-role model and thinking selections in local variables.
12. Keep each role edit pending until both model and thinking are confirmed. Only then replace the orchestrator's completed selection; nested cancellation discards the pending edit. Configuration modules receive completed selections and apply business rules to construct the configuration.
13. Do not introduce a singleton, temporary files, or persistent draft state. Confirm saves `maestro.json`; cancellation from the main setup screen discards the in-memory selections.

Related behavior: [REQ3](spec.md#req3-maestro-must-display-each-selected-roles-model-and-thinking-on-the-setup-screen) and [REQ4](spec.md#req4-maestro-must-provide-searchable-model-selection-using-pis-available-catalog).

## Reasons and limits

1. In Pi 1.5.0, `ctx.ui.select()` lacks search and bounded list display.
2. The exported `ModelSelectorComponent` requires a session `ModelRuntime` not exposed by the public extension context.
3. Public `Input` and `SelectList` support the required composition without a new library.
4. The owner approved the new `src/ui/` directory, dedicated modules under `src/ui/` and `src/config/`, and `src/maestro/setupConfiguration.ts` for this change. Other module names remain implementation choices.
5. UI/business separation is a design constraint, not a behavioral requirement or a separate acceptance criterion.

## References

1. `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`: public extension context and UI.
2. `node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/model-selector.d.ts`: native picker constructor.
3. `node_modules/@earendil-works/pi-tui/dist/components/select-list.d.ts`: list filtering and navigation.
4. `node_modules/@earendil-works/pi-coding-agent/examples/extensions/preset.ts`: public selector composition example.
