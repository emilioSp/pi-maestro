---
type: Roadmap
id: 'MAESTRO-21'
title: 'Label acceptance criterion coverage'
status: completed
---

## Objective

Label each `acceptance criterion` as success, failure, or unchanged behavior, describing the scenario rather than its test result.

These labels were later removed in `0.12.0`.

## Completed When

- Each criterion has one `Coverage` label: `success`, `failure`, or `unchanged`.
- Examples match their labels, and a rejected invalid action counts as a passing failure scenario.
- `Maestro` presents the labels during review. A `spec` does not need every category.
