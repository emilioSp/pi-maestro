# Two acceptance criteria

### REQ1: Persist saved titles

Delta: added

Saving and reopening an item must retain its title.

Verified by: [AC1](#ac1-saved-title-is-persisted)

#### AC1: Saved title is persisted

1. Probe: Change and save an item's title, then reopen it.
2. Expected result: The saved title is present.
3. Example: Change "Draft" to "Shopping", save, and reopen the item. Its title is "Shopping".

## Regression checks

### AC2: Existing descriptions remain saved

1. Probe: Change and save the title of an item with a saved description, then reopen it.
2. Expected result: The description is unchanged.
3. Example: An item with the saved description "Buy milk" is renamed and reopened. Its description remains "Buy milk".
