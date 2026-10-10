# Design decisions

## 2026-10-07: Keep the workflow independent of Git

1. Decision: `Maestro` uses the Pi project directory and saved workflow phase. It does not require Git or create automatic commits.
2. Reason: Simplify the project.
3. Replaced approach: Git requirements, checkpoints, and automatic commits. Other evaluated alternatives are not recorded.
4. Constraints: The `verifier` checks live project files. The `owner` controls later Git use, pull requests, and merging.
5. Compatibility: This change removed revision and commit fields without migration or compatibility readers. Interrupted and older workflows require manual `owner` handling.

Evidence: [Commit deae41c](https://github.com/emilioSp/pi-maestro/commit/deae41ce66a3f2c76859209c44165e7ddd0f3a72), [Changelog 0.6.0](CHANGELOG.md#060), and [workflow completion](docs/workflow.md#workflow-completion).

## 2026-10-08: Store escalation decisions in builder handoffs

1. Decision: Numbered `builder` `handoffs` contain `escalation` questions and their `owner` resolutions. One call records all current answers.
2. Reason: Use the same storage, local ID, and batch decision model as `verifier` `findings`. No parallel storage model is needed.
3. Replaced approach: Standalone `escalation` files and singular resolution tools.
4. Constraints: IDs restart at `E1` in each `handoff`. References include both IDs, such as `B1/E1`. Answers update only the active handoff's resolution fields.
5. Compatibility: No migration, fallback readers, or deprecated aliases. `Artifact` versions remain `1.0.0` despite the breaking change.

Evidence: [Repository-only specification](.specs/20261008-132344-store-escalations-in-builder-handoffs/spec.md), [Commit dda6eb5](https://github.com/emilioSp/pi-maestro/commit/dda6eb5b3ab76ba175112c3c565c70be747d7344), and [escalation workflow](docs/workflow.md#escalations).
