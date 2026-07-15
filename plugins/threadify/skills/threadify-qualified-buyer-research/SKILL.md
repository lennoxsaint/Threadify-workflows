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
4. Build and version an Offer Context Map before searching: who the offer serves, the problem it solves, the promised transformation, evidence that proves fit, and explicit exclusions. If this context is missing, stop with `missing_offer_context`.
5. Derive short searches from the mapped problem, failed attempts, stakes, and desired outcome. Search problem language, not broad identity labels. Prefer posts from the last 72 hours.
6. Judge each query by relevant, first-person problem matches among the first five results. One owned, offer-mapped problem is enough to inspect; zero means rewrite the query. Never lower qualification standards to rescue weak results.
7. Inspect the entire post, visible replies, profile, and relevant recent content before evaluating the candidate. The candidate must have authored the problem; anonymous submissions, quotes, and reposts are language research only.
8. Run immutable hard gates before action eligibility or scoring. Reject stale, seller-funnel, teaching, duplicate, suppressed, contradictory, unsafe, or pitch-only candidates. Do not reject someone merely because they sell an offer.
9. Prove audience fit, problem fit, and transformation fit against the Offer Context Map. Genuine pain without direct offer mapping is `research_only`, not a lead.
10. Require a safe public context and one distinct useful contribution. Saturated or disputed threads remain `research_only` when another reply would add noise or relationship risk.
11. Score pain, intent, fit, warmth, permission-readiness, and risk from 1 to 5 only after the gates pass, then classify the next stage.
12. A like never creates DM permission. A score never overrides a gate.
13. Draft one useful next move. If the user requested staging, type the exact text into the correct composer and stop before send.
14. Show the account, source, Offer Context Map version, fit evidence, evaluation, exact text, destination, and action at the approval gate.
15. Log outcomes and evaluate learning only after the 72-hour outcome window or an earlier terminal outcome.
16. Return a receipt. Treat `no_change_insufficient_evidence` as a successful honest result.

Never click Send, schedule, publish, make a paid ask, or silently change accounts without explicit final approval.
