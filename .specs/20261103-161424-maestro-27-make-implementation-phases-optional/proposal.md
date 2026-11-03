# MAESTRO-27: Make implementation phases optional

## Problem

Maestro currently requires builder, verifier, and simplifier execution after spec approval. The owner cannot finish with only an approved spec or skip selected later phases.

## Goal and scope

Use one `required` boolean per agent in `.pi/maestro.json` to select the implementation phases. Keep this change limited to configuration, the affected workflow paths, and their presentation.

## Out of scope

Running verifier or simplifier without builder, a separate phase-selection interface, configuration caching or runtime flag changes, and workflow recovery.

## Required behavior

See [spec.md](spec.md). Technical decisions are recorded in [design.md](design.md).
