---
type: Roadmap
id: 'MAESTRO-18'
title: 'Record escalation resolutions when the spec changes'
status: completed
---

## Objective

Save every current `escalation` answer in the original `builder` `handoff`, whether the `spec` stays unchanged or needs revision.

## Completed When

- One batch saves each answer and the owner's reason before changing phase.
- Without a `spec` change, the workflow returns to `ready-for-builder` without renewed approval.
- A revision decision identifies the `escalation` and agreed change, then returns to `drafting-spec`.
- The revised `spec` requires renewed `GREEN FLAG` and separate approval before another `builder` `run`.
- Direct approval from `escalation-decisions` is rejected. Transitions use `transitionWorkflow` and the central transition definitions.
