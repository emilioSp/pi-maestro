# Restart an existing spec

## Requirements

### REQ4: Maestro MUST offer new spec or restart selection at activation when existing specs are available

Delta: added

Selecting restart opens a selector of existing specs in the configured spec directory. The owner selects the spec; Maestro does not choose automatically.

Verified by: [AC1](#ac1-restart-choice-opens-the-existing-spec-selector).

#### AC1: Restart choice opens the existing spec selector

GIVEN Maestro is inactive and the configured spec directory contains `20261101-100000-add-search` and `20261102-100000-add-filter`.

WHEN the owner activates `/maestro` and chooses restart instead of a new spec.

THEN Maestro presents both existing specs for owner selection.

Example: Run `/maestro`, choose “Restart spec” rather than “New spec”; the selector offers `20261101-100000-add-search` and `20261102-100000-add-filter`.

### REQ1: Maestro MUST reopen the existing spec selected by the owner in drafting-spec

Delta: added

The selected spec retains its identity and directory. Restart does not create a new spec. The previous saved phase does not select the restart point.

Verified by: [AC2](#ac2-selected-spec-restarts-in-drafting).

#### AC2: Selected spec restarts in drafting

GIVEN an existing spec in any valid saved workflow phase, including `drafting-spec`, all ready and decision phases, all three running phases, and `candidate-ready`.

WHEN the owner selects that spec for restart.

THEN that same spec is active with saved phase `drafting-spec`, without creating another spec directory.

Example: Select `20261101-100000-add-search`, saved in `verifier-running`; Maestro activates that ID and records `drafting-spec` in its existing `workflow.json`, without creating another spec directory. Repeat the scenario independently for every other valid saved phase, including `builder-running`, `simplifier-running`, and `candidate-ready`.

### REQ2: Maestro MUST preserve existing files when restarting a spec except for the workflow phase

Delta: added

Includes proposal, spec, optional design, prototypes, handoffs, and product files.

Verified by: Code inspection of the restart operation; no dedicated test, as agreed with the owner.

### REQ3: Maestro MUST review the restarted spec documents with the owner before requesting renewed GREEN FLAG

Delta: added

Read the existing proposal, spec, and design when present. Normal configured execution follows renewed approval.

Verified by: [AC3](#ac3-restarted-documents-are-reviewed-before-approval).

#### AC3: Restarted documents are reviewed before approval

GIVEN a restarted spec with `proposal.md`, `spec.md`, and `design.md`.

WHEN Maestro prepares the renewed approval request.

THEN the request follows reading and reviewing those existing documents with the owner.

Example: Restart `20261101-100000-add-search`; Maestro reads its proposal, spec, and design, discusses the document set with the owner, and then requests `GREEN FLAG` for that set.

### REQ5: Maestro MUST preserve the effect of saved owner decisions across a spec restart

Delta: added

Restart does not invalidate handoffs or their recorded owner decisions. After renewed approval, those decisions have the same effect as in the normal workflow with the same approved documents and saved decisions. During the restart review, Maestro does not present unanswered escalations for owner discussion or resolution.

Verified by: Code and instruction inspection; no dedicated tests, as agreed with the owner.

### REQ7: Maestro MUST activate directly for a new spec when no existing specs are available

Delta: added

Applies when the configured spec directory is empty or absent. Skip the new-or-restart choice; activation does not create a spec automatically.

Verified by: [AC4](#ac4-empty-spec-directory-skips-the-choice), [AC5](#ac5-absent-spec-directory-skips-the-choice).

#### AC4: Empty spec directory skips the choice

GIVEN Maestro is inactive and the configured spec directory exists but is empty.

WHEN the owner activates `/maestro`.

THEN Maestro activates for new spec preparation without presenting the new-or-restart choice.

Example: With an empty `.specs/`, run `/maestro`; Maestro activates for a new spec without showing “New spec” or “Restart spec”.

#### AC5: Absent spec directory skips the choice

GIVEN Maestro is inactive and the configured spec directory does not exist.

WHEN the owner activates `/maestro`.

THEN Maestro activates for new spec preparation without presenting the new-or-restart choice.

Example: With `specDirectory` set to `.specs` and no `.specs/` directory, run `/maestro`; Maestro activates for a new spec without showing “New spec” or “Restart spec”.

