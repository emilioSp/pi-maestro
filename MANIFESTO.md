# The Pi Maestro Manifesto

Pi Maestro started from the need to use an engineering method when working with agents. With simple prompts or the "let’s write a plan" approach, I would sometimes reach
dead ends and have to start over. Agents would say the work was complete too early, without checking the result enough.

Spec-driven development seemed suitable for this problem. So I tried to turn it into a workflow that worked in practice: define the expected behavior, ask one agent to
implement it, and ask another to check it independently.

At first, I tried to do everything through skills. However, I noticed that agents would skip steps in the protocol described in the Markdown files. My impression was that
following the workflow required too much attention compared to the assigned task.

The workflow must be enforced by code, not by the prompt.

So I introduced deterministic tools that control transitions and check the reports produced by agents. Basically, I built a finite state machine where each step requires
a structured handoff. This handoff also becomes the starting point for the next agent.

Taking inspiration from OpenSpec and GitHub Spec Kit, I adopted the concepts that suited the way I work:

- `proposal.md` for the context, goal, and scope of the change.
- `spec.md` for requirements in the form "actor MUST…" and acceptance criteria using `GIVEN`, `WHEN`, `THEN` and concrete examples.
- `design.md` when important technical decisions are needed.

Once the spec is written and approved, the Maestro (orchestrator) starts coordinating a sequence of agents:

- Builder, responsible for implementation.
- Verifier, responsible for checking that everything works as specified.
- Simplifier, responsible for simplifying the code to make it clearer.

Only writing the spec is required. Builder, Verifier, and Simplifier are enabled through configuration. I believe the amount of work done by agents should match the
difficulty of the change. In some cases, I use Maestro only to prepare the spec, which I then divide into smaller specs.

I have chosen Pi because it provides events to control the runtime. This made it easy to add the maestro without going through an MCP server. Pi also works with different
LLM models. Using different models for each role allows for a more critical view of the spec: a builder and a verifier from the same "family" will approach the problem in
similar ways.

Of course, Maestro alone is not enough. You need clear project rules, clear requirements, tests, and human review of the result. You still need to understand what you are
building and where you want to go.
