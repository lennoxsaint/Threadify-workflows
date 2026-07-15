# Qualified Buyer Research

Find people worth talking to without spamming strangers or walking into somebody else's funnel.

This workflow searches the words a buyer would use, checks the entire post and profile, rejects misleading candidates, classifies the next honest stage, and may stage exact copy in a browser composer. It always stops before send.

## Run order

1. Confirm the intended account with `get_connection_defaults` and visible browser identity.
2. Load only user-approved offer, audience, proof, voice, and suppression context.
3. Create an `OfferContextV1` map for this user and run: audience served, problem solved, promised transformation, acceptable fit evidence, exclusions, and version. Do not reuse another user's niche assumptions.
4. Turn the mapped problem, failed attempts, stakes, and desired outcomes into narrow search phrases. Prefer posts from the last 72 hours and reject posts older than seven days unless they are explicitly retained as language research only.
5. Sample the first five results. Record intended-problem matches and first-person ownership matches. One owned, offer-mapped problem is enough to inspect; zero means rewrite the query instead of weakening qualification.
6. Inspect each candidate's full post, visible replies, profile, and relevant recent content. Confirm the candidate authored the problem.
7. Run hard gates before action eligibility or scoring. A high score never overrides seller-funnel, advice, stale, duplicate, suppression, profile-conflict, approval, permission, or proof rules. Having an offer is not itself a rejection.
8. Record direct evidence for audience fit, problem fit, and transformation fit. Missing offer context stops the run; authentic pain with no direct offer mapping is `research_only`.
9. Confirm that the public thread is safe and the proposed reply adds distinct value. A saturated or disputed thread may be `research_only` even when the person and problem are genuine.
10. Classify the candidate as `reject`, `research_only`, `public_reply_ready`, `dm_permission_ready`, `call_ready`, or `offer_ready`.
11. Draft one useful non-pitch reply or the exact next eligible message.
12. With a verified logged-in browser, type the draft into the correct composer only when the user asked for staging. Stop before send and show the exact text, account, source, Offer Context Map version, fit evidence, destination, and action.
13. Record the outcome later. A like or generic reply is not qualified progression.
14. Return a versioned receipt, including an honest no-change result when learning evidence is incomplete.

## Offer fit is user-specific

The workflow is niche-agnostic, not context-free. Every run must use the current user's Offer Context Map. A garden designer, fitness coach, accountant, author, or software consultant can all qualify, but only when their authored problem maps directly to the audience, problem, and transformation of the user's actual offer.

## Learning rule

Qualified progression within 72 hours is the primary signal. It requires new pain, attempt, stakes, fit, permission, resource acceptance, call, offer, or payment evidence.

- Fewer than 10 completed comparable outcomes: `no_change_insufficient_evidence`.
- 10 to 19 completed outcomes: propose a soft rule or weight change only.
- 20 completed outcomes across two batches: auto-apply only when both batches improve qualified progression by at least 20 percentage points, false positives do not worsen, and hard-gate breaches remain zero.
- Trust, consent, approval, account verification, and proof gates never self-modify.

## Public and private boundary

Public examples must be synthetic, redacted, or approved public material. Do not place private messages, member records, account identifiers, private metrics, local proof paths, credentials, or proprietary generation logic in this repo.

## Browser fallback

Threadify MCP does not claim a public outbound search or reply-send capability in this workflow. Search and composer staging use an available logged-in browser or a manual review packet. If the account cannot be verified, return `blocked_wrong_account`. If the browser is unavailable, return the exact candidate evaluation and proposed text without claiming it was staged.
