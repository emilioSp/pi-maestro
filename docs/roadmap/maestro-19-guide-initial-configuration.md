---
type: Roadmap
id: 'MAESTRO-19'
title: 'Guide initial configuration'
status: completed
---

## Objective

Help the `owner` configure `Maestro` through guided selectors instead of writing the configuration file manually.

See the [specification](../../.specs/20261108-141712-maestro-19-guide-initial-configuration-with-pi-selectors/spec.md).

## Completed When

- When `.pi/maestro.json` is absent, `/maestro` offers role selection and confirmation.
- Each selected role has searchable model selection followed by Pi's supported thinking choices, starting at the first choice. Model selection does not change the main
  conversation's model.
- Completed selections can be replaced. Cancelling a nested choice discards only that pending edit; cancelling setup saves nothing.
- Confirmation saves the configuration and activates `Maestro`. Only selected roles are enabled; selecting none enables `spec` preparation only.
- There are no default models. An existing configuration missing an enabled role's model prevents activation.
- Setup uses public Pi controls, without private runtime access or a separate model runtime.
