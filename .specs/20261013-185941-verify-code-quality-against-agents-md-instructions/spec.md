# 20261013-185941-verify-code-quality-against-agents-md-instructions: Verify code quality against AGENTS.md instructions

Motivation and scope: [proposal.md](proposal.md). Technical decisions: [design.md](design.md).

## Requirements

### REQ2: Make instruction-violation findings traceable

Delta: added

Each finding about an instruction violation identifies the applicable `AGENTS.md` file, quotes the violated instruction, and explains the code violation.

Verified by: [AC2](#ac2-instruction-violations-require-traceable-findings)

#### AC2: Instruction violations require traceable findings

1. Probe: Inspect the revised guidance for reporting a code-quality instruction violation.
2. Expected result: The finding must identify the instruction file, quote the instruction, and explain the violating code.
3. Example: `AGENTS.md` says "Do not use relative paths for source imports." Candidate code contains `import { save } from './save.ts';`. The required finding names `AGENTS.md`, includes that exact quote, and explains that the import uses a relative source path.

### REQ4: Skip only the added review when directives are absent

Delta: added

If no applicable code-quality directives are present, skip only the added review. Missing `AGENTS.md` files are not errors or findings. Do not invent directives or require those files to be created.

Verified by: [AC5](#ac5-the-added-review-is-skipped-when-no-applicable-directives-exist)

#### AC5: The added review is skipped when no applicable directives exist

1. Probe: Inspect how the revised guidance handles absent `AGENTS.md` files and present files without code-quality directives.
2. Expected result: In both cases, the added review is skipped without treating missing directives as an error or finding.
3. Example: A spec contains AC1 for saving a title. No applicable global or project `AGENTS.md` exists. The guidance skips the added review, requires independent verification of AC1, and requires no missing-file finding. The same result applies if the only applicable `AGENTS.md` says "Read ROADMAP.md at session start" and contains no code-quality directives.

### REQ5: Limit quality review to code affected by the approved change

Delta: added

Code-quality review covers only code affected by the approved change. It does not audit unrelated project code.

Verified by: [AC4](#ac4-code-quality-review-is-required-within-the-approved-change-when-directives-exist)

#### AC4: Code-quality review is required within the approved change when directives exist

1. Probe: With applicable code-quality directives present, inspect the revised guidance for the review obligation and its boundary.
2. Expected result: The guidance requires review against those directives only for code affected by the approved change.
3. Example: `AGENTS.md` prohibits relative source imports. A change affects `src/saveTitle.ts`. Unrelated `src/exportReport.ts` uses a relative import. The guidance requires reviewing affected code in `src/saveTitle.ts`, not auditing `src/exportReport.ts` for code quality.

## Regression checks

### AC1: Independent verification remains mandatory

1. Probe: Read the revised verifier guidance alongside its existing verification duties.
2. Expected result: Every approved acceptance criterion still requires independent verification, in addition to code-quality review.
3. Example: A spec contains AC1 for saving a title and AC2 for reopening it. The guidance requires independent checks of both criteria even when code-quality review finds an instruction violation.

### AC3: Personal preferences cannot become findings

1. Probe: Inspect the revised guidance for the boundary between instruction violations and personal preferences.
2. Expected result: The guidance excludes personal style preferences as requirements.
3. Example: No applicable instruction requires alphabetical imports. Candidate imports are not alphabetical. The guidance does not permit a finding based only on that preference.
