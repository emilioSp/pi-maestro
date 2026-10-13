# 20261013-202811-check-acceptance-criterion-numbering-before-builder-execution: Check acceptance criterion numbering before builder execution

> After owner approval, this specification is the contract for the builder and verifier.

## 1. Context, goals, and scope

R-05 in `ROADMAP.md` requires criterion numbering that starts at AC1 and continues without gaps. Reject incorrect numbering when Maestro records spec approval.

### Out of scope

No new tool, renumbering by the approval tool, check for missing criteria, or matching of criterion IDs against handoffs. No additional checks in builder launch or unchanged-contract decision resolution.

## 2. Requirements and constraints

Reuse `src/workflow/spec/markSpecReady.ts`, called by `maestro_mark_spec_ready`. Read the current `spec.md` and extract numbers in document order using `/^### AC(\d+):/gm`.

For each match, compare its numeric value with its one-based position. Valid numbering starts at 1 and continues without gaps. This checks ordering only, not number spelling or criterion content. Zero matches pass this check.

Before saving `ready-for-builder`, reject invalid numbering by throwing an error that includes `Fix acceptance criterion ordering in spec.md.` Leave all saved workflow files and the spec unchanged on rejection.

Apply the check to initial approval and renewed approval in the existing permitted phases. Preserve the existing active-spec, file, workflow-identity, and phase checks, tool input, and successful result. Reuse existing successful-approval test coverage rather than adding a dedicated consecutive-numbering test.

Maestro guidance must explain recovery from this validation error: keep the current drafting or decision phase, correct only numbering and affected references in the current spec without changing criterion order or requirements, then retry `maestro_mark_spec_ready` using the existing GREEN FLAG. After the transition succeeds, start the builder without requesting another approval. This exception applies only to failed numbering validation, not successful approval or running agents.

## 3. Technical decisions

Keep validation in the existing approval operation instead of adding a tool or workflow phase. It already checks approval prerequisites before saving the transition. See `src/workflow/spec/markSpecReady.ts` and `src/workflow/transitions.ts`.

Use a text regex, not a Markdown parser. Only matches of the stated expression participate in ordering validation. The check does not validate heading presence or format.

## 4. Acceptance criteria

### AC1: Incorrect numbering produces an ordering error

1. Probe: Approve specs with a wrong starting number, a gap, a duplicate, or reversed ordering.
2. Expected result: Each approval throws an error containing `Fix acceptance criterion ordering in spec.md.`
3. Example: In `drafting-spec`, approve separate specs with matched sequences `[2]`, `[1, 3]`, `[1, 1]`, and `[1, 3, 2]`. Each call throws the ordering error. Repeat an invalid sequence `[1, 3]` in both decision phases and receive the same error.

### AC2: Rejected numbering changes no saved files

1. Probe: Record the current spec and saved workflow files, then attempt approval with invalid numbering in each existing approval phase.
2. Expected result: Every recorded file retains exactly its previous content.
3. Example: In `findings-decision`, the spec contains `### AC1: First` and `### AC3: Third`. Attempt approval. The spec, workflow file, and existing handoffs remain byte-for-byte unchanged, including phase `findings-decision`. Repeat in `drafting-spec` and `escalation-decision` with their phases unchanged.

### AC3: Maestro guidance continues after numbering correction without another approval

1. Probe: Inspect the Maestro instructions for the recovery procedure after an ordering validation error following GREEN FLAG.
2. Expected result: The instructions require a numbering-only correction in the unchanged permitted phase, retrying approval with the existing GREEN FLAG, and starting the builder after success without requesting another approval.
3. Example: After GREEN FLAG, approval fails in `drafting-spec` for headings AC1 and AC3, where another paragraph refers to AC3. The written procedure directs Maestro to change AC3 and that reference to AC2 without changing the requirements or criterion order, retry `maestro_mark_spec_ready`, then call `maestro_run_builder` after success. No new GREEN FLAG is requested.
