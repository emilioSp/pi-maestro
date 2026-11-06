# Two acceptance criteria

### REQ1: The system MUST persist saved titles

Delta: added

Verified by: [AC1](#ac1-saved-title-is-persisted)

#### AC1: Saved title is persisted

- GIVEN a saved item.
- WHEN its title is changed and saved, then the item is reopened.
- THEN the saved title is present.
- Example: Change "Draft" to "Shopping", save, and reopen the item. Its title is "Shopping".

## Regression checks

### AC2: Existing descriptions remain saved

- GIVEN an item with a saved description.
- WHEN its title is changed and saved, then the item is reopened.
- THEN the description is unchanged.
- Example: An item with the saved description "Buy milk" is renamed and reopened. Its description remains "Buy milk".
