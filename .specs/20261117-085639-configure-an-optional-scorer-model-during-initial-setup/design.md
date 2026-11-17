# Configure an optional scorer model during initial setup

## Decisions

Use the following code boundaries for the behavior defined in [spec.md](spec.md).

| Area | Files | Boundary |
| --- | --- | --- |
| Setup menu | `src/ui/showSetupMenu.ts` | Return the selected role and display the scorer model without thinking. |
| Classifier picker | `src/ui/selectClassifier.ts` | Select from supplied classifier choices by reusing `src/ui/selectModel.ts`. |
| Setup orchestration | `src/maestro/setupConfiguration.ts` | Fetch available classifiers, invoke the classifier picker, and bypass thinking selection for the scorer. |
| Configuration | `src/config/schema.ts`, `defaults.ts`, `loadConfiguration.ts`, `saveConfiguration.ts`, `assertConfiguration.ts` | Define, resolve, persist, and validate scorer configuration. |
| Routing | `src/workflow/transitions.ts` | Keep all phase destination decisions here, using the existing optional-phase pattern. |
| Tool outcomes | Builder, verifier, simplifier, finding-resolution, and simplifier-handoff tools | Accept and report the returned completion phase instead of assuming scoring always follows. |
| Existing scorer | `src/score/requestEvaluation.ts`, `src/score/scoreWorkflow.ts` | Replace fixed model lookup and report identity; reuse evaluation logic. |
| Agent guidance | `agents/maestro.md`, `agents/verifier.md`, `agents/simplifier.md` | Follow optional scoring routes and report skipped scoring. These are runtime instructions, not excluded human documentation. |
| Scoring tool | `src/tools/main/score-workflow.ts` | Replace fixed-Jev wording with configured-classifier wording. |
| Tests | Relevant existing test modules | Apply the verification boundary in spec.md. |

`src/ui/selectClassifier.ts` is the only approved new source module. The existing picker provides the searchable model-selection UI, avoiding duplicate UI implementation.

## Contracts and prototypes

Setup orchestration remains in `setupConfiguration.ts`: call `showSetupMenu.ts`, receive a role, then call `selectClassifier.ts` for the scorer. The menu does not invoke the picker directly. The classifier picker reuses `selectModel.ts`; confirmation persists selections through `saveConfiguration.ts`.
