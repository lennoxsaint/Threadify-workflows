# Buyer Questions to Content

Use this workflow to turn real buyer questions into a private content brief or draft. Start from sources the user supplies. Follow [Threadify-001](../../docs/threadify-001.md) only if the owner wants a current Threadify drafting, save or delivery capability.

Ask:

> Turn these buyer questions into one deidentified content draft. Tell me whether the idea comes from one source or a repeated pattern.

## Run the workflow

1. Import the minimum factual question evidence and private source reference. Do not copy the full conversation into the content record.
2. Run `questions-to-content`. Treat one question as `single` evidence. Use `repeated` only when distinct source records support the same underlying question. Repeated comments from one person or duplicated text do not increase the count.
3. Remove names, handles, links, unusual personal facts and other unnecessary identifiers. Deidentification reduces exposure; it is not a promise that reidentification is impossible.
4. Draft one useful answer within the evidence. Do not present one person's question as a market trend, customer majority or sales signal.
5. Show the exact draft, evidence label, distinct source count, uncertainty and private source map. Obtain exact approval before any provider save, schedule or publication.
6. Run `save-content` only for the approved local candidate. A local save is not a provider draft or publication.

```sh
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations questions-to-content --state /absolute/private/directory
```

From a source checkout, use `node bin/threadify-workflows.mjs conversations ...`. If an optional content tool is unavailable, return the same local draft and manual next step. Keep feedback local unless the owner separately opts into sharing its exact text.
