# Score completed Maestro workflows with Jev

## Problem

Completed implementation workflows have no independent, structured evaluation of delivery correctness or verification quality. Instruction-only evaluation can be skipped or produce unsupported scores.

## Goal and scope

Evaluate the entire implementation workflow against its approved contract using Jev in a new scorer-running phase before candidate-ready. Save two distinct scores and the raw response in the spec folder. Make a saved evaluation outcome a prerequisite for completion.

Include all implementation passes, recorded decisions, and the final code changes. Use a dedicated Maestro tool and Pi's existing classifier support.

## Out of scope

- An overall score, weights, or assessment of spec quality.
- Per-agent or per-pass scores.
- Historical code snapshots, seeded-defect benchmarks, or new verification runs.
- Automated tests of Jev's judgments or Pi's classifier implementation and provider calls. Pi and Jev are trusted integrations.
- Another agent, dependency, or direct provider API integration.
- Automatic repair, model fallback, or automatic inference retries.
- Human-facing documentation updates, including README.md, docs/, CHANGELOG.md, and ADR.md; these will be handled separately. Runtime agent instructions needed to operate the scoring phase remain in scope.

## Required behavior

See [spec.md](spec.md) and [design.md](design.md).
