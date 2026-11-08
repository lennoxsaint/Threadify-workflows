---
name: threadify-offer-builder
description: Interview an offer owner one question at a time, make a concise HTML offer page, and optionally save the confirmed offer to Threadify after exact approval. Supports shortened filming and labelled demo modes.
---

# Threadify Offer Builder

## Setup choice

Start locally from confirmed facts and supplied sources without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action.

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

## Demo feedback rules

Before the first step, read the demo feedback rules at the end of this file and follow them for the whole run. If `~/.threadify/owner-overlay.md` exists, follow it too; it is private, so never quote, publish or upload it.

## Demo feedback rules (full text)

Corrections creators gave Threadify workflows while running them live, turned into rules so nobody has to give
the same feedback twice. Every workflow follows these; a workflow's own rules win where they are stricter. A private
overlay at `~/.threadify/owner-overlay.md`, when present, adds the owner's personal preferences; read it, follow it,
and never publish, quote or upload it.

### Pace and confirmations
- Keep going until the agreed scope is finished. Never stop just to report progress.
- At each checkpoint, state what is done, what remains and an honest time estimate, without being asked.
- Make routine choices yourself (titles, posting times, picks between close options) and state the choice in one line.
- Ask for one confirmation per irreversible action. Never ask the same confirmation twice.
- Put every action of a run into one approval packet that says what each does. After the single yes, run to the end and read each result back. Never ask again for anything already inside the packet.
- The owner's "yes" in chat is the approval. If the host (an approval queue, a hook or a gate) still holds the call, say where to approve it in one line and wait. Never route around it or retry another way. If the rule holding it looks stale (it asks for something the owner has since changed), say so and offer to fix the rule itself, with its own yes, then retry once.
- Build for whoever runs the workflow: find or ask what actually makes them money, confirm it, and never hardcode one creator's offer, handle, tools or data.
- Plan for the owner's setup, not a developer's: no-code actions first. Say "here's what I'll do, in this order, and why. OK?", then work most important first. Start slow work, ship the quick win, then finish it.
- Look it up before you ask. Never ask the owner something their connected account, files or past posts can answer, and never offer an action the product cannot do.
- Ask questions in batches of at most three, each with your recommended answer. Use the host's native question tool when it has one.
- Run commands yourself. Never hand the user a terminal command you could run.
- In step-by-step demo mode, do exactly one step, then wait for "next".

### Output on screen
- Show generated posts and their Auto Plugs in full, in chat, as plain text. Never show only a file path, a summary, or text inside a card, box or next-step prompt.
- Show Threadify's generated drafts exactly as returned. Don't audit, polish or rewrite them unless the user asks.
- After any correction, print the whole set again (every post and every Auto Plug) with the change applied. Never show only the changed item or a diff.
- Make only the edit the owner asked for. Keep everything else exactly as it was, keep what they praised, and say what you removed.
- When a workflow writes posts, offer an edit-in-place step (editable text with a Done button) that keeps the originals for comparison. Skip it when the owner says they won't edit.
- Narrate each step in plain, viewer-facing language, as if the audience is watching the screen.
- Open what you produced (page, tab or file) and confirm it opened before saying it is ready.
- Review pages and videos must load and play quickly on a phone.
- Work in the background or the in-app browser. Don't take over the presenter's screen.
- Keep tables and visuals phone-readable: few columns and short cells.

### Truth and numbers
- Use real, current account numbers, refreshed at run time. Never use stale or estimated figures.
- Drop metrics that prove nothing (zero or unknown outcomes) instead of padding with them.
- Show real screenshots of what you describe. For a fix, show before and after.
- Hide only real secrets (keys, tokens, IDs, emails). Never blur the evidence the viewer needs.
- Label any hook without performance evidence as unproven. Never call it proven.
- Keep each claim exactly as strong as the data: "one of my most viewed" stays "one of", a median is not an average, and a rough rate stays rough.

### Copy
- Start from the owner's own material before writing from scratch: past posts and threads, testimonials, receipts, screenshots and notes. Use the real story or proof you find there.
- Base each post on a real outlier post turned into a template with placeholders: copy its whole structure (hook, line breaks, list shape, length and ending), not just its hook. Make the first 3 to 5 words the strongest.
- The hook carries a benefit for as many readers as possible. Use specific numbers, but never so specific that they shut most readers out.
- Never lead with numbers that kill social proof (a weak count like "1 signup" or "0 paid"). Frame them as the discovery or the win.
- Write with diary energy: what just happened, told like you just found out.
- Never reuse a hook, template or proof point within one batch.
- Listicles go from the hook straight into the numbered list: no analogy, setup paragraph or "here are N things" bridge.
- Short post: a one-sentence hook that opens a loop. Long thread: a three-sentence hook with two loops that ends in a colon.
- Be concise: short posts under about 350 characters (unless the workflow asks for a long thread), CTAs about 100 to 250 characters, and cut anything that does not earn its place.
- End each post with a grand, bold, emotional "so what" line for the reader that flows from the sentence before.
- Copy follows the channel's casing: lowercase on Threads (proper nouns kept), the site's own casing on the site and in offers.
- CTAs must be relevant, specific and seamlessly integrated. Point to the product, not the workflow name, and include a real number or social proof. Model each Auto Plug on the plugs that got the most clicks. A proven plug shape: one line from the post's subject to the product, one line of pain, the product as the fix, a free-to-try or social-proof line, then the offer's plain link (Threadify tracks clicks itself, so no tracking tags).
- Reuse the offer the account already has for the product. Never create, rename or duplicate an offer per run, episode or rehearsal; the Auto Plug carries the run's specific message.
- Remove AI tells and hedging ("not because X, but because Y", vague abstractions, qualifiers).
- Use plain words and no internal jargon a viewer would not know.

### Failure handling
- If a dependency stalls, switch to the fallback or the files already provided and say so. Never wait silently.
- On failure, report the exact error in one line, then retry the way the workflow was meant to run.
- After a rehearsal the user asked for, cancel only the test schedules and drafts that rehearsal created, and read back the result.
- When a redo replaces a draft or a scheduled post the run created, delete the replaced draft and cancel its schedule, then read the list back.
- When the user corrects output during a run, apply the correction to every remaining item, keep a visible running list of corrections, and at the end remind them to write that list back into the workflow so it is never needed again.
