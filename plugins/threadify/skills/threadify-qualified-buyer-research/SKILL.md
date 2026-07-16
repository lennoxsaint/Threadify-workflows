---
name: threadify-qualified-buyer-research
description: Find current buyer-language posts, reject misleading or off-offer candidates, stage a useful public reply without sending, and learn only from qualified outcomes. Use when a user wants offer-aligned keyword research or buyer qualification on Threads.
---

# Threadify Qualified Buyer Research

Use when a user wants to find current buyer-language posts, reject false-positive leads, stage a useful reply, or learn from completed outreach outcomes without automating sends.

## Instructions

1. Read `workflows/qualified-buyer-research/manifest.json` and `workflows/qualified-buyer-research/README.md`.
2. Verify the intended Threadify account and the visible browser account before any composer action.
3. Use only approved clean audience, offer, proof, voice, and suppression context. Do not place private source material into public examples or receipts.
4. Build and version an Offer Context Map before searching: observable audience situation, current problem, desired outcome, common failed approaches, fit evidence, exclusions, and later-stage commercial criteria. If this context is missing, stop with `missing_offer_context`.
5. Ask for 3-5 approved voice samples. If fewer than three are available, use a concise plain-human fallback and record `voice_confidence: low`; never imitate another person or fabricate lived experience.
6. Search narrow buyer language first in this order: problem, failed attempt, stakes, desired outcome, then workaround or objection. Search situation and problem language, not broad identity labels. Prefer posts from the last 72 hours.
7. Judge each query by relevant, first-person problem matches among the first five results. One owned, offer-mapped problem is enough to inspect; zero means rewrite one element and continue. Never lower qualification standards to rescue weak results.
8. Search until one candidate qualifies, then stop by default. A larger target count must be explicit. If no candidate qualifies after 10 rewrites or 50 inspected results, return `no_qualified_candidate` with the exact stop reason.
9. Inspect the entire post, visible replies, profile, and relevant recent content before evaluating the candidate. The candidate must have authored a concrete current problem; anonymous submissions, quotes, and reposts are language research only.
10. Run immutable hard gates before action eligibility or scoring. Reject stale, seller-funnel, teaching, duplicate, suppressed, contradictory, or pitch-only candidates. Route incomplete, saturated, disputed, or unsafe-to-reply contexts to `research_only`. Do not reject someone merely because they sell an offer.
11. Require situation-first audience fit, current-problem fit, desired-outcome fit, and at least one supporting signal: failed attempt, meaningful stakes, or genuine request for help. Solution awareness is informational and never required. Profile labels may support but never override situation evidence.
12. Route genuine off-offer pain to `adjacent_off_offer_research` with the rejection reason and Offer Context version. Never mix it into the active Buyer Language Bank.
13. Require a safe public context and one distinct useful contribution. Saturated or disputed threads remain `research_only` when another reply would add noise or relationship risk.
14. Score pain, intent, fit, warmth, permission-readiness, and risk from 1 to 5 only after the gates pass. Scores rank eligible candidates and control later DM/call/offer stages; they do not veto public-reply readiness. Calls and offers additionally require permission and commercial evidence.
15. Choose one reply branch. With clear context: acknowledge the exact signal, optionally relate through approved truthful experience, explain one mechanism, give one practical next move, and state the honest tradeoff without forcing a question. With a real evidence gap: use A-C-A diagnostically and ask exactly one useful question.
16. Keep the first public reply offer-free: no offer mention, link, DM ask, call ask, or paid ask. If the user requested staging, type the exact text into the correct composer and stop before send.
17. Show the account, source, Offer Context and Voice Context versions, fit and supporting evidence, evaluation, exact text, destination, and action at the approval gate.
18. Preserve staged and sent variants. Classify owner edits across truth, relevance, mechanism, action, tradeoff, and voice; those edits may teach message policy only, never candidate policy.
19. Evaluate outcomes after 72 hours or an earlier terminal outcome. Only new pain, attempt, stakes, desired outcome, permission, resource acceptance, call, offer, or payment counts as qualified progression. Likes and generic replies do not count.
20. Return a receipt. Treat `no_qualified_candidate` and `no_change_insufficient_evidence` as successful honest results.

Never click Send, schedule, publish, make a paid ask, or silently change accounts without explicit final approval.
