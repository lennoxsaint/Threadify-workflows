# Threadify Offer Builder

## Setup choice

Before provider calls, if no preference is known, ask: "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?"

Follow [Threadify-001: setup and first-loop video](../../docs/threadify-001.md). Honor an existing choice. A local or filming request starts the interview immediately; do not add a setup question to the ten-question interview. Setup never grants write authority.


Offer Architect is a ten-question adaptive interview for anyone selling a real offer. It creates a short responsive HTML page and a separate preparation handoff. Threadify storage is optional and requires exact action approval.

## Invoke now

Tell your agent: “Read skills/threadify-offer-builder/SKILL.md and run Offer Architect. Ask one question at a time.” Add “in shortened filming mode” to ask questions 1, 2, 3, then 10. Questions 4–9 remain skipped; critical missing details are resolved in final confirmation. Add “mock demo” only for an explicitly fictional rehearsal.

The skill is directly usable from a checkout; this does not install or replace a global plugin. The repository's existing plugin installation process exposes the bundled skills after a release. Plugin installation and connecting the OAuth app are separate actions. MCP endpoint: https://www.threadify.app/api/mcp/threadify. Installation never authorizes an offer write.

## Render the supplied demo

From the repository root, choose a new output directory:

```sh
node skills/threadify-offer-builder/references/offer-builder.mjs skills/threadify-offer-builder/references/example.json /tmp/offer-builder-demo
```

Open `/tmp/offer-builder-demo/offer.html`. Its visible demo label means the example is fictional. No CTA destination, proof or price is invented. Owner notes and save state are in `owner-handoff.json`.

For a real interview, use the same JSON fields with `mode: full` or `filming`, the actual answered question numbers, `confirmed: true` only after final fact confirmation, and the owner's real HTTPS destination. The renderer does not contact Threadify. A missing link leaves an inactive next step and blocks `prepareSave`.

The module exposes `inspect`, `questionOrder`, `render`, `prepareSave` and `verifyReadback`. `prepareSave` accepts verified discovery context `{account, accountVerified, discoveryComplete, offers}`; offer records use `offer_id`, name, benefit, link, type and facts. The agent must normalize actual provider results using the current schema. It first returns `awaiting_action_approval`; only the exact digest from a subsequently approved action may be supplied as `approvedDigest`. This is a local preparation guard, not an authorization service. Account verification, answer truth and provider readback must come from actual tools and user responses.

One matching name or URL proposes an update; multiple matches block. Review the full facts list because updates replace it. Equal records return `no_change`. Changing account, target or fields changes the digest and invalidates approval. Readback checks account, ID and every mapped field; for a create, additionally match the ID returned by create_offer before calling the helper.

## Verification boundary

```sh
npm test
```

Focused tests cover full/filming sequencing, incomplete answers, demo isolation, escaping and unsafe destinations, duplicate ambiguity, replacement facts, stale approval, retry identity and readback mismatch. They do not prove that an agent conducted a real interview, OAuth works, or CTA Studio saved an offer. Exercise those with an owner before claiming live integration success. No public post is created by this workflow.
