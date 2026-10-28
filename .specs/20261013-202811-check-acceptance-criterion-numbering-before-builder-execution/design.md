# 20261013-202811-check-acceptance-criterion-numbering-before-builder-execution: Check acceptance criterion numbering before builder execution

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions

Keep validation in the existing approval operation instead of adding a tool or workflow phase. It already checks approval prerequisites before saving the transition. See `src/workflow/spec/markSpecReady.ts` and `src/workflow/transitions.ts`.

Use a text regex, not a Markdown parser. Only matches of the expression stated in [spec.md](spec.md) participate in ordering validation. The check does not validate heading presence or format.
