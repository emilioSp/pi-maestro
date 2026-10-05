STATUS: DONE

# Task mvp_06: Rework the final candidate handoff

This task records an earlier design for the final candidate handoff. That design used a `final-review` workflow phase and a Maestro checkpoint commit.

The current design replaces that checkpoint with the read-only `maestro_check_candidate` tool from Task 42. The workflow remains in `candidate-ready`. The tool checks the current verifier handoff and clean checkout, then returns Pull Request facts without changing files or workflow state.

The owner controls the Git flow, review, Pull Request, and merge after the candidate check.
