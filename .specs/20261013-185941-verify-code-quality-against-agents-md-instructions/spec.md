# 20261013-185941-verify-code-quality-against-agents-md-instructions: Verify code quality against AGENTS.md instructions

> After owner approval, this specification is the contract for the builder and verifier.

## 1. Context, goals, and scope

Implement R-16 from `ROADMAP.md`. Add explicit code-quality review when applicable `AGENTS.md` code-quality directives are present.

The current guidance requires reading those files and following technical rules. It does not explicitly require reviewing candidate code for instruction violations.

Code-quality review covers only code affected by the approved change. It does not audit unrelated project code.

Product changes are limited to `agents/verifier.md`. Documentation, tests, schemas, tools, dependencies, and other product files remain unchanged. Preserve the owner's existing `ROADMAP.md` changes.

## 2. Requirements and constraints

1. Code-quality review supplements all existing verifier responsibilities. Every acceptance criterion still requires independent verification.
2. Each finding about an instruction violation identifies the applicable `AGENTS.md` file, quotes the violated instruction, and explains the code violation.
3. Personal style preferences are not requirements.
4. If no applicable code-quality directives are present, skip only the added review. Missing `AGENTS.md` files are not errors or findings. Do not invent directives or require those files to be created.

## 3. Technical decisions and prototypes

### Keep the existing finding format

Use existing evidence fields for the instruction file, quote, and violation explanation. No new schema fields or automatic quote validation are required.

`src/artifacts/verifier-handoff/schema.ts` supports these details through `evidence.source` and `evidence.observation`. It also permits `acceptanceCriterion: null` when no specific criterion applies. Existing owner decisions remain unchanged.

### Verification boundary

This change concerns written guidance. Acceptance probes inspect that guidance against the concrete scenarios below. They do not require additional model runs or changes to project tests.

## 4. Acceptance criteria

### AC1: Independent verification remains mandatory

1. Probe: Read the revised verifier guidance alongside its existing verification duties.
2. Expected result: Every approved acceptance criterion still requires independent verification, in addition to code-quality review.
3. Example: A spec contains AC1 for saving a title and AC2 for reopening it. The guidance requires independent checks of both criteria even when code-quality review finds an instruction violation.

### AC2: Instruction violations require traceable findings

1. Probe: Inspect the revised guidance for reporting a code-quality instruction violation.
2. Expected result: The finding must identify the instruction file, quote the instruction, and explain the violating code.
3. Example: `AGENTS.md` says "Do not use relative paths for source imports." Candidate code contains `import { save } from './save.ts';`. The required finding names `AGENTS.md`, includes that exact quote, and explains that the import uses a relative source path.

### AC3: Personal preferences cannot become findings

1. Probe: Inspect the revised guidance for the boundary between instruction violations and personal preferences.
2. Expected result: The guidance excludes personal style preferences as requirements.
3. Example: No applicable instruction requires alphabetical imports. Candidate imports are not alphabetical. The guidance does not permit a finding based only on that preference.

### AC4: Code-quality review is required within the approved change when directives exist

1. Probe: With applicable code-quality directives present, inspect the revised guidance for the review obligation and its boundary.
2. Expected result: The guidance requires review against those directives only for code affected by the approved change.
3. Example: `AGENTS.md` prohibits relative source imports. A change affects `src/saveTitle.ts`. Unrelated `src/exportReport.ts` uses a relative import. The guidance requires reviewing affected code in `src/saveTitle.ts`, not auditing `src/exportReport.ts` for code quality.

### AC5: The added review is skipped when no applicable directives exist

1. Probe: Inspect how the revised guidance handles absent `AGENTS.md` files and present files without code-quality directives.
2. Expected result: In both cases, the added review is skipped without treating missing directives as an error or finding.
3. Example: A spec contains AC1 for saving a title. No applicable global or project `AGENTS.md` exists. The guidance skips the added review, requires independent verification of AC1, and requires no missing-file finding. The same result applies if the only applicable `AGENTS.md` says "Read ROADMAP.md at session start" and contains no code-quality directives.
