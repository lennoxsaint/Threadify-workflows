# Agree the Next Step

Use this workflow to turn a live buyer conversation into one clear, reviewable next step. Start with the supplied conversation and confirmed offer. Follow [Threadify-001](../../docs/threadify-001.md) when the proposed action needs a useful connected capability.

Ask:

> Agree the next step from this conversation. Show me the exact text and destination before anything happens.

## Run the workflow

1. Inspect the current source and offer. If relevance is unknown, return to Your Next Moves or ask one discovery question instead of forcing an action.
2. Prepare one action with exact text, recipient, destination and any promised date. Avoid vague phrases such as "follow up later."
3. Run `review`. Show the single action and bound hash. The owner's decision is exactly `approve` or `reject`.
4. Treat recipient interest, permission for the proposed channel and owner approval as separate evidence. One does not imply another.
5. Reinspect the source immediately before delivery. Run `begin-attempt` with the exact current revision before the host acts.
6. Run `receipt` with `succeeded`, `confirmed_not_sent` or `unknown` based on the real result. Never treat a successful tool request without readback as delivery proof.

```sh
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations review --state /absolute/private/directory
```

If `THREADIFY_WORKFLOWS_HOME` was set during installation, use that state root instead of `~/.threadify-workflows`. From a source checkout, use `node bin/threadify-workflows.mjs conversations ...`. Writes consume JSON on standard input and require `--revision N`.

When no supported delivery tool exists, return the exact copy-and-paste action. The owner performs it manually and supplies the result. Do not treat silence as approval or outcome evidence.
