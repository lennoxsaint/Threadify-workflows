# Secondary Proof Loops use cases

These are reusable orchestration recipes for the smaller ideas named in episode 015 and the Brain-to-draft example in episode 016. They are not independent hosted services. Ask your agent to read the chosen recipe. The current tool schema and your account's entitlements determine which steps are available.

For every connected recipe: call get_connection_defaults first, verify the intended owned account and scopes, read only the evidence needed, and show uncertainty. Stop before mutations and ask for exact action approval. Never send private source material to another service without approval. If a tool is unavailable, retain a local review artifact, list the missing evidence and give the manual next step. Missing data is not zero activity.

## One-win founder clinic

Ask: “Inspect my available growth, conversion and post receipts. Recommend one action with its evidence and a clear next step.”

Use read_post_receipts, get_growth_signal and, when available, get_next_best_actions for the selected account. Keep the evidence window and missing data explicit. Choose one supported action tied to the owner's stated objective; distinguish a recommendation from a result. Return observation, source/window, proposed action, approval needed and how to check the outcome. Do not infer retention, revenue or causality from reach. Run once unless a recurring task is separately requested and verified.

## Conversion detective

Ask: “Compare posts with verified conversion evidence against relevant posts without it, and prepare one next-post hypothesis.”

Use read_link_attribution, read_post_performance and read_post_receipts with comparable windows. A click is not a sale; missing attribution is not a non-conversion. Label sample limits and association. Return the comparison, one testable copy/CTA hypothesis and a proposed draft brief. Follow Create My Day for an actual reviewed draft; scheduling needs separate approval.

## Winner DNA sequels

Ask: “Find the reusable structure in my strongest relevant posts and prepare one fresh sequel without copying their wording.”

Use greatest_hits and the full source text, plus get_growth_signal if entitled. Identify a structure and explain its source. Use the owner's chosen drafting provider (craft_viral_post only when available and suitable, or an explicitly chosen local method). Preserve original facts and rights; a new story needs real new evidence. Return one review draft and its source map. Follow [Weekly Winner Replication](../skills/threadify-weekly-winner-replication/SKILL.md) for the existing wider workflow.

## Comments become the product roadmap

Ask: “Review relevant comments on my posts and group recurring problems, keeping direct evidence separate from feature guesses.”

Use list_comments or entitled analyze_comments, respecting pagination and the requested window. Separate unique people from repeated comments. Return a small private table of problem, source evidence, frequency definition, uncertainty and one proposed discovery question. Do not expose commenter details in public examples. Do not create roadmap tickets, reply or DM without an explicit request and exact action approval.

## Content control room

Ask: “Show my draft and calendar status, missing approvals and provider failures in one local review view.”

Read list_drafts, list_scheduled_posts and read_post_receipts for the same owned account/window. Use [Create My Week](../skills/threadify-create-my-week/SKILL.md) for planning and local review. Label draft, reviewed, scheduled and published separately. Missing readback stays unverified. No automatic scheduling or recurring monitor is implied by creating the view.

## Voice compiler that learns from corrections

Ask: “Compare the draft I approved with my final edit. Propose one precise voice rule for review.”

Use the owner-supplied original and final text; preserve exact versions. Distinguish a one-off edit from a durable rule. Keep feedback local by default. If the owner asks to save it, show the exact feedback and account before record_feedback or an approved Brain change. Use [Content Brain Repair](../skills/threadify-content-brain-repair/SKILL.md) and [Brain Sync](../skills/threadify-personal-brain-sync/SKILL.md) for the guarded write/readback loop. Saved feedback is not proof all future drafts improved.

## Reviewed Threads plus X campaign

Ask: “Prepare a Threads campaign and an X adaptation, with separate previews and platform approvals.”

Use [Create My Day](../skills/threadify-create-my-day/SKILL.md) for reviewed source drafts and [Crosspost X After Threads](../skills/threadify-crosspost-x-after-threads/SKILL.md) for the existing platform workflow. Verify connected accounts, current limits, credits and supported operations. Show the exact copy/media/account/time for each platform. Do not silently cross-post or infer X success from a Threads result; keep individual provider readbacks.

## Public proof ledger

Ask: “Prepare a public-safe summary of my verified work, separating actions, outcomes and unknowns.”

Start from read_post_receipts or owner-approved receipts. Produce a private ledger with source, observed time, action, provider state, outcome and uncertainty. Redact secrets and personal/customer details before proposing a public excerpt. Distinguish local artifacts, requested actions, verified saves, schedules, publications and measured outcomes. A receipt alone is not permission to publish it. Obtain exact approval before external sharing.

## Brain-to-draft

Ask: “Use my approved Brain voice, current audience and selected offer to prepare one draft for review.”

Read get_brain_overview/query_brain, get_audience_demographics when available, and list_offers. Confirm the intended offer and format rather than inventing one. Use generate_content for the connected Brain path, or the user's explicitly selected local drafting path. Keep absent audience data unknown. Check the full draft against source facts, rights, current offer terms and destination. Show a review draft, not a publication claim. Use the existing Create My Day validation, exact approval, scheduling and readback flow if scheduling is requested. Never repeat the episode's personal figures or historical tool count as current facts.
