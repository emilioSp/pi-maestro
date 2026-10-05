STATUS: DONE

# Task mvp_06: Rework the final candidate handoff

This task records an earlier design for the final candidate handoff. That design used a `final-review` workflow phase and a Maestro checkpoint commit.

The approved MVP design now ends the workflow at `candidate-ready`. The operations that produce this phase own the required checks. Maestro reads the artifacts and Git information to summarize the results and Pull Request facts without a dedicated tool.

[Task 42](42_complete_candidate_ready_handoff.md) implements this follow-up decision and removes the old final-review tool, domain operation, phase, and checkpoint. This completed task records only the earlier implementation.

The owner controls the Git flow, review, Pull Request, and merge from `candidate-ready`.
