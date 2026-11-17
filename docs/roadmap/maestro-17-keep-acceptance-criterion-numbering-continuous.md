---
type: Roadmap
id: 'MAESTRO-17'
title: 'Keep acceptance criterion numbering continuous'
status: completed
---

## Objective

Reject gaps in `acceptance criterion` numbering before approving a `spec`.

See the
[specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-202811-check-acceptance-criterion-numbering-before-builder-execution/spec.md).

## Completed When

- Numbered criterion headings start at `AC1` and continue without gaps.
- Invalid numbering is rejected without changing saved files.
- `Maestro` can correct numbering and references without changing criterion order or requirements, then retry using the existing `GREEN FLAG`.
