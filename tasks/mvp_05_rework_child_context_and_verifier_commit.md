STATUS: DONE

# Task mvp_05: Share the current-checkout child context

## Dependency

This task depends on `mvp_02_add_current_branch_spec_revision_flow.md`, `mvp_03_rework_builder_for_current_checkout.md`, and `mvp_04_rework_verifier_for_current_checkout.md`.

Task 34 depends on this task for the shared child context.

## Objective

Make every child adapter use the current checkout and explicit workflow identity without branch-name discovery.

The verifier handoff implementation and protocol commit belong to Task 34. Child extension registration, role allowlists, and `spec.md` path protection belong to Task 35.

## Plan references

- Sections [5](../plan.md#plan-section-5), [6.8](../plan.md#plan-section-6-8), [6.11](../plan.md#plan-section-6-11), and [6.12](../plan.md#plan-section-6-12)
- Section [6.14](../plan.md#plan-section-6-14), child artifact context

## Work

1. Use one shared `getChildContext({ cwd, specId })` operation for all child adapters.
2. Use the shared context in builder handoff, builder escalation, and the verifier handoff tool.
3. Keep `specId` explicit in every child tool schema. Do not infer identity or role from a branch name and do not perform global workflow discovery.
4. Keep workflow phase and `specId` validation in the domain operations before any artifact write.
5. Use the TypeBox-inferred tool parameters. Do not add duplicate schema checks or unsafe parameter casts.

Do not implement child extension registration, role allowlists, direct `spec.md` path protection, verifier protocol commits, or Pi delegation here.

## Tests

Cover:

- current repository resolution from a child working directory;
- explicit spec identity passed to builder and verifier adapters;
- invalid spec IDs rejected before context creation;
- no branch-name parsing or global workflow discovery;
- builder handoff and escalation continue to use the shared context.

## Completion criteria

- All child adapters use one current-checkout context operation.
- Child tools never infer workflow identity from a branch name.
- Every child artifact operation receives an explicit `specId`.
- Domain operations remain responsible for phase and identity validation.
- Verifier handoff commit and child extension protections remain scoped to Tasks 34 and 35.
