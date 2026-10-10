---
name: docs-audit
description: Audit README.md, docs/, and the project constitution (mission, tech stack, roadmap, and changelog) against the current working tree without asking for a comparison baseline. Use when reviewing documentation consistency, stale references, broken links, roadmap state, or documentation-to-code mismatches.
---

# Documentation audit

Run a read-only audit. Do not modify documentation or code during the audit. Propose corrections in the report and ask for confirmation before applying them.

## Starting point

Always compare the current documentation with the current working tree, including staged, unstaged, and untracked files. Start the audit without asking the owner for a commit, range, or comparison baseline.

Do not check out historical commits or limit the audit to a Git diff. Use history only as supporting evidence for past changes, completed outcomes, and changelog entries.

## Scope

Check `README.md`, `docs/`, and the available project constitution:

1. `../../../MISSION.md`: purpose, scope, and owner responsibilities.
2. `../../../TECH_STACK.md`: technologies and their roles.
3. `../../../ROADMAP.md`: completed outcomes and planned priorities.
4. `../../../CHANGELOG.md`: meaningful codebase changes and breaking contracts.

These four files default to the project root. Discover alternative names, directories, or embedded sections from the repository and its instructions. Audit the actual documents rather than assuming a fixed layout. Report missing documents only when project instructions require them.

Use `package.json`, `package-lock.json`, and the code under `src/`, `extensions/`, `agents/`, and `templates/` as comparison sources. `package.json` is authoritative for declared scripts, dependencies, peer dependencies, import aliases, published files, and the Pi manifest. Use relevant specs, tests, configuration, and local Git history as supporting evidence.

## Procedure

### 1. Inventory

1. Check the working tree with `git status` and record existing changes.
2. Read `AGENTS.md` and all applicable instructions before evaluating style or structure.
3. List available documentation and locate the project constitution.
4. Identify referenced files, directories, symbols, commands, roadmap identifiers, versions, and links.
5. Distinguish current behavior, owner-approved intent, future work, and historical changes.

Do not invent missing history, decisions, approvals, dates, or versions. GitHub PRs can provide optional supporting evidence, but GitHub access and GitHub Releases are not required.

### 2. Documentation consistency

Audit all current documentation in scope, not only changed files. Use `git diff --find-renames` when useful to understand working-tree changes and moved documents. These diffs support the audit but do not replace the current code as its comparison baseline.

Search for references to removed, renamed, or simplified files, symbols, and behaviors. Check that restart, deactivation, and `/resume` decisions are consistent across current documentation. Do not treat an accurately labeled historical changelog entry as a current behavior claim.

Check that documentation follows this rule, with paths relative to the project root:

In `README.md`, `docs/*.md`, `MISSION.md`, `TECH_STACK.md`, `ROADMAP.md`, and `CHANGELOG.md`, format terms from `docs/glossary.md` with inline code. Do not apply this formatting to section titles, blockquotes (`>`), link labels, or text inside quotation marks. Do not format `spec` within `spec-driven` phrases. Leave possessive forms, such as `owner's`, unformatted. Include plurals and capitalization variants only when they have the glossary meaning. Do not change wording, code blocks, link targets, or file paths just to apply this formatting.

### 3. Links and references

Check these references from each document's actual location:

1. Markdown file links and internal anchors.
2. Roadmap identifiers, specification links, commit references, and version references.
3. Paths and filename case, including references to deleted or renamed files.
4. API, function, class, tool, and command names against the code.
5. Published documentation links against package contents or clearly declared repository-only targets.

Do not report an explicitly labeled future placeholder as a broken implementation claim without checking its context. If remote links cannot be checked, report that limit rather than claiming that they are valid or broken.

### 4. Documentation-to-code comparison

Check current operational claims against code and tests:

1. Registered commands, tools, extensions, and entry points.
2. API and method names.
3. Workflow phases, transitions, live state, and persisted state.
4. Recovery, retry, restart, deactivation, and `/resume` behavior.
5. Paths, branches, worktrees, and artifacts.
6. Configuration, validation, dependencies, and development checks.
7. Features described as currently available to the owner.

Report an overclaim when current usage documentation presents an unimplemented feature as available. Clearly labeled future work is not an overclaim. Existing code is evidence of implemented behavior, not automatic proof that the owner intended that behavior.

### 5. Project constitution

#### Mission

Check that purpose, scope boundaries, and owner responsibilities agree across the mission and other documentation. Distinguish intended capabilities from capabilities already implemented. Report contradictions without rewriting the mission to match the current code automatically.

#### Tech stack

Compare listed runtime technologies and development tools with manifests, configuration, and code. Check their stated roles and any documented versions or constraints. Planned choices must remain clearly labeled as planned, and descriptions must not silently become mandatory rules.

#### Roadmap

Check identifiers for uniqueness and references for consistency. Compare outcome descriptions, scope boundaries, known dependencies, completion conditions, and specification links with the available evidence. Check that partially implemented work is not described as wholly complete.

Where the roadmap uses Completed, Now, Next, and Later, check their documented meaning and priorities. Completed entries need evidence consistent with owner acceptance. Passing tests, an agent handoff, or `candidate-ready` alone do not prove final owner review.

Report absent completion evidence as unverified, not automatically false. Do not infer acceptance dates from spec identifiers or creation dates. Do not promote priorities or treat roadmap entries as permission to implement.

#### Changelog

Check meaningful change summaries and breaking contracts against code, diffs, and available history. Check migration instructions against supported behavior. Where version boundaries exist, verify them through tags and commit ancestry rather than PR merge dates.

Check the declared history range when available. A concise changelog can omit older history and routine maintenance. Do not require every commit, every version, a GitHub Release, or invented publication dates.

Unreleased entries describe actual changes outside recorded version boundaries, not roadmap ideas. Historical entries can describe behavior later removed or reverted. Report omissions of meaningful changes within the reviewed range and contradictions with current documentation.

Do not add tests, features, or requirements merely because they are absent. Report mismatches with the project's recorded decisions and leave new decisions to the owner.

### 6. Report

Write a concise report in English, ordered by severity. For every finding include:

1. Severity: `High`, `Medium`, or `Low`.
2. File path and line number.
3. Problem.
4. Evidence from code, history, or another document.
5. Impact.
6. Recommended correction.

If no problems are found, state this explicitly. Record that the current working tree was audited, along with checks performed, verified links, and relevant evidence limits. Confirm that no files were modified.

Do not apply corrections in the same pass unless the owner explicitly asks after reviewing the report.
