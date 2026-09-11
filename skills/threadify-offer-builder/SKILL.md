---
name: threadify-offer-builder
description: Interview an offer owner one question at a time, make a concise HTML offer page, and optionally save the confirmed offer to Threadify after exact approval. Supports shortened filming and labelled demo modes.
---

# Threadify Offer Builder

## Setup choice

Before provider calls, if no preference is known, ask: "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?"

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md). Honor an existing choice. A local or filming request starts the interview immediately; do not add a setup question to the ten-question interview. Setup never grants write authority.


The interview is called Offer Architect. Use it for a service, product, course, asset, membership, newsletter, or other real offer. Start locally; no account is needed for the interview or page. Read references/offer-builder.mjs for the structured input and preparation guards. Resolve all references relative to this skill directory.

## Interview

Ask ten concise adaptive questions, **one at a time**, waiting for each answer. Use native Ask User Questions or request_user_input_async when available, with free text allowed. Use request_user_input only in a mode where that tool is supported. Otherwise ask in plain conversation. Never send the whole questionnaire at once. Never treat silence, a preselected option, or elapsed time as an answer.

Reuse volunteered answers, but confirm their meaning in the relevant turn. Adapt wording to the buyer's business. Challenge vague words such as “transformation” with one concrete deliverable question. Ask minimal follow-ups only when the answer changes the offer or safe next step. No revenue threshold, proof quota, or arbitrary metric is required.

1. Who is this for, and what problem are they trying to solve?
2. What exactly will they receive, and what should it help them do?
3. How does delivery work, and what is included?
4. What do they use or do instead today?
5. What makes your approach different from those alternatives?
6. What evidence can we honestly show? No proof yet is a valid answer.
7. Who is this a good fit for, and what are the limits or buyer responsibilities?
8. What are the price and terms, if decided?
9. Where should the reader go next? Ask for the real destination and action.
10. Show a short factual summary and unknowns. Ask the owner to confirm/correct it and the next step. Resolve missing name, buyer, deliverable/benefit, delivery, CTA wording, or real destination here before a save can be prepared. A missing destination may stay unknown for a local draft; it blocks saving. Confirmation of facts is separate from action approval.

**Shortened filming mode:** only when requested, ask 1, 2, 3, then jump to 10. Mark questions 4–9 `skipped` and their answers unknown. Do not quietly fill them with assumptions. Q10 can collect critical missing name/destination/CTA details in minimal follow-ups, without pretending skipped questions were asked. Say “shortened interview confirmed,” never “all ten questions completed.”

**Mock/demo mode:** only when explicitly requested. Label the page “DEMO — fictional example,” record interview completion as false, and block all offer saves. Fictional fixture facts are not customer proof. Never present a mock as recovered GPT instructions, an automatic conversion, or an actual interview.

## Local result

After Q10 confirmation, map supported answers to the JSON shape in references/example.json. Preserve exact confirmed facts. Keep unknown fields null or empty; no invented prices, promises, testimonials, scarcity, proof, or metrics. facts is a list of approved public supporting statements, not private notes. Supply only copy the owner has confirmed; reconfirm material edits.

Run `node references/offer-builder.mjs input.json output-directory` from this directory, using a fresh output directory per revision. It creates offer.html and owner-handoff.json. The module has no network calls. The page uses one headline, clear buyer, concrete deliverable, delivery details, optional proof/terms, generous whitespace and one next step. Keep copy very short (aim below 180 words); remove generic hype, jargon and repeated benefits. Never compress away important limits. Owner notes, unknowns and preparation state belong in the separate handoff. A draft with no destination shows an inactive next step, never a fake working button. Inspect the actual page on desktop and mobile before handoff when browser tools exist; report unavailable visual verification.

## Optional Threadify save

Read current tool schemas before every integration session; the reference mapping was inspected on 2026-09-11 and can change. No publishing or scheduling is part of this skill.

1. Call get_connection_defaults **first**, before other Threadify tools. Verify the intended owned account from its response; clarify ambiguity. Inspect scopes and connection status. Do not infer a connected account from plugin installation.
2. Call list_offers scoped to that account, follow pagination if exposed, and check both name and destination for duplicates. Never copy unrelated offers into public output. One match proposes update; multiple matches require the owner to choose. An unchanged offer needs no write. Re-read a selected record immediately before proposing an update.
3. Map name, benefit, link, type, facts and account exactly. Current types are community, course, asset, newsletter, other; service/product map to other. update_offer additionally needs the selected offer_id. Its facts field **replaces the full list**: show retained and removed facts and approve the full replacement. Never merge private facts into the page automatically.
4. Show the exact create/update action, account, target offer (for update), complete payload and destination. Request explicit final action approval per repository contract, even if connection autonomy is enabled. A prior interview confirmation or app installation is not this approval. Changed payload/account/target invalidates it.
5. Prepare a stable idempotency_key for the exact approved account/action/target/payload, using prepareSave in the module. Reuse that key on an uncertain retry; inspect list_offers before retrying. Never generate a fresh key to bypass an ambiguous result. Do not claim the local guard verifies authorization; the agent must ground it in the actual answer and current discovery.
6. Only after that approval, call create_offer or update_offer. Read list_offers again and match returned ID, account context and exact name/benefit/link/type/facts. Do not rely on a success toast alone. An uncertain result remains `save_unverified`; preserve the request and reconcile before further writes. Inspect the saved record in CTA Studio when accessible. Record provider readback and UI visibility separately; a save is not a published post, click or customer outcome.

Missing tools/auth, denied scope, invalid/missing link, duplicate ambiguity or readback mismatch: retain offer.html and an inspectable owner-handoff.json with exact blocker, intended mapping and next setup step. Never widen permissions or retry a denied call unchanged.

## Setup and receipts

The plugin supplies workflow instructions. The OAuth app connection supplies access to Threadify tools. Connect through the client's supported MCP settings using `https://www.threadify.app/api/mcp/threadify`, then authorize the intended account and needed offer permissions. If the client lacks remote MCP, use the local page and copy the confirmed fields into CTA Studio manually; record manual verification separately. Do not imply every client exposes the same installation controls. See references/threadify-001.md for repository setup guidance.

No system-wide installation is needed: tell an agent to read this SKILL.md and start question 1, optionally “in shortened filming mode.” A plugin release is a separate step. When Threadify itself is the offer, require current approved facts and the canonical /plans destination with the current brand's full attribution parameters; do not invent the attribution key set or use historical promotion URLs.

Return the page path, owner handoff path, mode, questions answered/skipped, unknowns, confirmation state, action approval state, actual save/readback/UI state and remaining step. Store private provider IDs/account details only in local owner receipts, never public examples or repository fixtures.
