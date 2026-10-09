---
name: threadify-30-day-viral-vault
description: Plan 30 days and prepare six rights-cleared Threads posts daily while revealing only the next unresolved card. Use for a 30-Day Viral Vault or a six-post one-at-a-time daily queue.
---

# 30-Day Viral Vault

Read `references/creator-system.md` and `references/creator-engine.md`. Use this skill's bundled `scripts/creator.mjs` with Node 18+ and a dedicated private state directory. The engine performs no provider calls.

## Start or resume

Run `vault30-status`, then `vault30-continue` before starting a new plan. Resume an unresolved or ambiguous card before preparing another day. Never display, summarize or tease a later card while a current card remains.

For a new plan, confirm:

1. The intended account and IANA timezone.
2. `reach_first`, `balanced` or `lead_first`. Balanced and lead-first require one current verified offer.
3. Exactly six distinct local posting times. Use fresh connected best-time/calendar evidence when available; otherwise ask the user for the times. Resolve timezone gaps or duplicated civil times explicitly.
4. The user understands that this workflow uses patterns from previously successful posts but does not guarantee virality, followers or leads.

Create the 30-day blueprint with `vault30-plan`. It contains slots only. Prepare copy for the current day just in time.

## Prepare today's six

Build exactly two `greatest_hit`, two `viral_vault`, and two `my_vault` cards. Require four `proven`, two `challenger`; two each of `broad`, `expertise`, and `personal`; at least three `viral_structure` values including one `listicle`; and at most one earned CTA.

- Reach first: zero earned CTAs and no lead-oriented requirement.
- Balanced: exactly one offer-aligned card, with at most one earned CTA.
- Lead first: exactly three buyer-problem cards, with at most one earned CTA.

Greatest Hits may use `exact_repost` only when the connected/user evidence proves that account owns the source. Every other card uses `literal_fill_in` only when current evidence proves ownership, license or permission. Declare every source-specific person, brand, number, claim, example, topic, personal proof and CTA destination as a placeholder. The template must reconstruct the exact source, and verified replacements must reconstruct the exact final post. A missing right, source span or replacement fact blocks that candidate. Do not silently switch to structure-only or cross-fill another lane.

Carry prior `leave_for_tomorrow` cards before topping up to six. Their content must remain byte-for-byte unchanged; only a new evidenced time suggestion may be appended. Save connected drafts with exact resolved copy when a deterministic provider surface exists. Never send source text to provider generation and never use `generate_content` for these cards.

Call `vault30-add-day` only after all six cards, rights proofs and suggestions pass. The engine returns only card one.

## Review exactly one card

Use `vault30-next`. Show only its returned card, source lineage, rights basis, literal template mapping, exact final parts, validation, and proposed local time.

- `edit`: persist the exact edit, revalidate, and show the same card again.
- `approve`: require fresh validation and exact owner approval, then persist the schedule intent.
- `edit and approve`: bind fresh validation and approval to the exact edited copy.
- `skip`: preserve the copy for tomorrow and advance.
- `reject`: close the card and advance.

Connected approval is not scheduling by itself. After `vault30-decide`, refresh account, timezone, facts, rights, provider validation and calendar. Use `vault30-begin-attempt` to persist the exact idempotent request before calling `schedule_post`. Never call `publish_now`. Then call `get_schedule_status` and use `vault30-reconcile` only when account, draft, copy, time, idempotency key and `scheduled` state match exactly.

An unavailable or ambiguous result stays `approved_unscheduled`, queues no retry and blocks the next card. Inspect provider state before doing anything else. Disconnected cards may use `vault30-complete-local` after exact approval; say “reviewed locally,” not “scheduled.”

After six decisions, show only a compact state rollup. Day 30 ends new packet generation. Preserve private state for recovery and keep source bodies, facts, drafts, IDs and receipts out of public artifacts.
