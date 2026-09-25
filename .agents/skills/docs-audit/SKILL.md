---
name: docs-audit
description: Audit README.md, docs/, tasks/, and plan.md against the repository source code or a selected Git commit range. Use when reviewing documentation consistency, stale references, broken links, task drift, or documentation-to-code mismatches.
---

# Documentation audit

Run a read-only audit. Do not modify documentation, code, or tasks during the audit. Propose corrections in the report and ask for confirmation before applying them.

## Starting point

Ask one question at the beginning:

> Do you want to start from a specific commit? Provide the SHA. If not, I will compare the documentation with the current code.

If the user answers `no`, compare the documentation with the current working tree.

If the user provides a commit:

1. Verify the SHA with Git.
2. Include the specified commit in the audit.
3. Use its parent as the comparison base and compare documentation through `HEAD`.
4. Read the commit history in order with `git log --reverse`.
5. Check both the documentation diff and the code changed in the same range.

If the commit is the repository root commit, use that commit as the first state without requiring a missing parent.

## Scope

Check these paths:

- `README.md`
- `docs/`
- `tasks/`
- `plan.md`

Use `package.json`, `package-lock.json`, and the code under `src/`, `extensions/`, `agents/`, and `templates/` as comparison sources. `package.json` is authoritative for scripts, dependencies, peer dependencies, import aliases, published files, and the Pi manifest. Do not treat a copy of `package.json` in `plan.md` as authoritative.

## Procedure

### 1. Inventory

- Check the working tree with `git status`.
- List the existing documentation files.
- Read `AGENTS.md` and all applicable instructions before evaluating style or structure.
- Identify files, directories, symbols, commands, tasks, and links mentioned by the documentation.

### 2. Changed documentation

When the audit starts from a commit:

- Use `git diff --find-renames` for `README.md`, `docs/`, `tasks/`, and `plan.md`.
- For each commit, connect documentation changes to the corresponding code changes.
- Search for references to removed, renamed, or simplified files, symbols, and behaviors.
- Check that decisions about restart, deactivation, and `/resume` are consistent across all pages.

### 3. Links and references

Check:

- Markdown links to existing files;
- existing internal anchors;
- references to existing tasks, commits, files, and directories;
- references to deleted or renamed files;
- names of APIs, functions, classes, tools, and commands present in the code.

For file references, also check the real path and case sensitivity. Do not report an explicitly declared future placeholder as an error without checking its context in the task.

### 4. Documentation-to-code comparison

Check operational claims against the code and tests:

- commands and tools that are actually registered;
- extensions and composition roots that are actually implemented;
- API and method names;
- workflow transitions and phases;
- live and persisted state;
- recovery, retry, restart, and `/resume` behavior;
- paths, branches, worktrees, and artifacts;
- configuration and validation;
- features described as available to users.

Always distinguish between:

- user documentation, which must describe what users can use;
- `plan.md`, which describes approved decisions;
- `tasks/`, which describes future or completed work.

If a document describes a future feature, check that it says so clearly and that the related task has a consistent status. If `README.md` or `docs/` describe a feature as available while it is still made of placeholders or `TODO` tasks, report it as a documentation overclaim.

### 5. Tasks and plan

Check:

- `STATUS` values against the existing code;
- dependencies on missing, obsolete, or incomplete tasks;
- references to valid plan sections;
- instructions to remove placeholders that have already been deleted;
- test requirements that are no longer desired or applicable;
- duplicated or contradictory decisions.

Do not add tests or requirements only because they are missing if the project does not consider them necessary. Report the mismatch and leave the decision to the user.

### 6. Report

Write a concise report in English, ordered by severity. For every finding include:

1. Severity: `High`, `Medium`, or `Low`.
2. File path and line number.
3. Problem.
4. Evidence from the code, diff, or another document.
5. Impact.
6. Recommended correction.

If you find no problems, state this explicitly. Also include:

- the Git range checked, when applicable;
- the checks performed;
- verified links and anchors;
- relevant consistent areas;
- confirmation that no files were modified.

Do not apply corrections in the same pass unless the user explicitly asks after reviewing the report.
