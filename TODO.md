# TODO

## Allow builder failure when all acceptance criteria pass

### Example

All acceptance criteria in the approved spec pass, including their breakage checks. A separate mandatory repository check, such as lint, fails. The builder cannot fix that failure within the pass, and no owner decision is needed.

The builder cannot report `done` because a required check fails. It must report `failed` while preserving the successful acceptance results.

### Restriction

`src/artifacts/builder-handoff/assertBuilderHandoff.ts` rejects a `failed` handoff when its nonempty acceptance criterion list contains only `probeStatus: passed` and `breakageStatus: confirmed`.

The tool reports: `Failed builder handoff cannot mark every acceptance check as completed.`

This prevents the builder from recording an honest failure in this case. The builder must report the protocol limitation to Maestro instead of changing successful results or omitting criteria.

### Correction

Allow `status: failed` even when every acceptance criterion passes. Keep `failure.reason` mandatory and preserve the actual criterion results.

Update the validator and its tests to cover this case. Remove the corresponding limitation from `agents/builder.md` after the correction. Keep the existing completion requirements for `status: done`.
