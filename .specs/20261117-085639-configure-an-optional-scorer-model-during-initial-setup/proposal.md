# Configure an optional scorer model during initial setup

## Problem

Workflow scoring uses a fixed classifier and cannot be disabled independently or configured during initial setup.

## Goal and scope

Make scoring optional and disabled by default. Allow the owner to select a classifier during initial setup and save its configuration in `.pi/maestro.json`, without a thinking level.

## Out of scope

Changes to scoring questions, score normalization, or evidence collection.

Project documentation changes, including README.md, docs/, and CHANGELOG.md.

## Required behavior

See [spec.md](spec.md).
