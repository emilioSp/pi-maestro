# 20261118-211851-clear-agent-model-selections-without-losing-other-roles: Clear agent model selections without losing other roles

## Requirements

### REQ1: The owner MUST be able to clear an individual role's model

Delta: added

In initial setup and in the Agent models menu, show `None — clear this role` as the first row of every model picker. Keep the row visible when searching, even if no models match. It clears the model and any thinking level without prompting for a replacement. If the role is already unset, it stays unset. Only Confirm saves the change. Closing the role picker without a choice leaves the draft selection unchanged; closing the agent menu without confirming discards the draft.

Verified by: [AC1](#ac1-none-clears-only-the-edited-role), [AC2](#ac2-closing-the-menu-discards-an-unconfirmed-clear), [AC3](#ac3-the-clear-action-stays-at-the-top-during-search), [AC5](#ac5-retained-roles-return-after-saving-and-reopening), and the [existing first-use setup test](../../extensions/maestro.integration.test.ts#L1628) (scenario `cancelled replacement model`).

#### AC1: None clears only the edited role

- GIVEN a role has a selected model in the agent menu
- WHEN the owner chooses None for that role and confirms
- THEN the role is saved without a model or thinking level and is disabled, without changing the other role selections.

| Menu and selections | Action | Saved selections |
| --- | --- | --- |
| Initial setup: Builder A (high), Verifier B (medium) | Set Verifier to None and confirm | Builder A (high); Verifier off with no model or thinking level |
| Agent models: Builder A (high), Simplifier B (low), Scorer C | Set Simplifier to None and confirm | Builder A (high) and Scorer C; Simplifier off with no model or thinking level |
| Agent models: no Builder, Verifier B (medium), Scorer C | Set Scorer to None and confirm | No Builder; Verifier B (medium) still saved; Scorer off with no classifier |

#### AC2: Closing the menu discards an unconfirmed clear

- GIVEN the agent menu has a draft role clear that has not been confirmed
- WHEN the owner closes the agent menu
- THEN the saved configuration is unchanged.

| Saved selections | Unconfirmed edit and exit | Saved selections after exit |
| --- | --- | --- |
| Builder A (high), Verifier B (medium) | Set Verifier to None, then close Agent models without confirming | Builder A (high), Verifier B (medium) |

#### AC3: The clear action stays at the top during search

- GIVEN the owner opens the picker for a role with a selected model
- WHEN the owner searches for a model
- THEN `None — clear this role` remains the first row regardless of matches.

| Selected role | Search | Picker result |
| --- | --- | --- |
| Verifier with model B | Type a query that matches no available models | `None — clear this role` remains the first selectable row; no model rows are shown |

### REQ2: Maestro MUST retain other role selections when Builder is cleared

Delta: added

Without a Builder, the menu identifies spec-only mode and shows selected Verifier, Simplifier, and Scorer roles as skipped, not unselected. Their selections remain editable. Confirming and reopening the menu preserves them. Selecting a Builder again makes those roles eligible to run without reselecting them.

Verified by: [AC4](#ac4-the-menu-shows-retained-roles-as-skipped), [AC5](#ac5-retained-roles-return-after-saving-and-reopening)

#### AC4: The menu shows retained roles as skipped

- GIVEN Builder and other roles have selected models
- WHEN the owner sets Builder to None
- THEN the draft menu identifies spec-only mode and shows the retained selections as skipped without a Builder.

| Selected roles | Action | Menu after the action |
| --- | --- | --- |
| Builder A (high), Verifier B (medium), Simplifier A (low), Scorer C | Set Builder to None | Builder is unset and the menu identifies spec-only mode; Verifier B (medium), Simplifier A (low), and Scorer C are shown as skipped without a Builder |

#### AC5: Retained roles return after saving and reopening

- GIVEN an agent menu draft includes Builder and other selected roles
- WHEN the owner sets Builder to None and confirms, then reopens the menu, selects a Builder, and confirms again
- THEN the saved configuration keeps the other selections across both confirmations and they become eligible to run with the new Builder.

| Selections before clearing Builder | Config after confirming None | Action after reopening Agent models | Final saved selections |
| --- | --- | --- | --- |
| Builder A (high), Verifier B (medium), Simplifier A (low), Scorer C | Builder off with no model or thinking level; Verifier B (medium), Simplifier A (low), and Scorer C kept but skipped | Select Builder B (high) and confirm | Builder B (high), Verifier B (medium), Simplifier A (low), and Scorer C selected to run |

## Verification scope

- **AC1 and AC5:** Prioritize new automated coverage for clearing a role (including the Scorer classifier) and for saving and reopening after clearing Builder.
- **AC2:** Inspect the cancel path and check that exiting after a draft clear leaves the saved configuration unchanged.
- **AC3:** Check the real terminal picker with a search that matches no models. A mocked picker does not establish that the action remains visible.
- **AC4:** Check the spec-only labels during the AC5 scenario; no separate automated test is needed.
