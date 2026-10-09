# Qualified Buyer Research

## Start here

Ask: "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?"

Follow [Threadify-001: setup and first-loop video](../../docs/threadify-001.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating signup. Setup never grants publishing or payment authority.


Find people worth talking to without spamming strangers or walking into somebody else's funnel.

This workflow searches the words a buyer would use, checks the entire post and profile, rejects misleading candidates, classifies the next honest stage, and may stage exact copy in a browser composer. It always stops before send.

## Run order

1. Confirm the intended account with `get_connection_defaults` and visible browser identity.
2. Load only user-approved offer, audience, proof, voice, and suppression context.
3. Create an `OfferContextV1` map for this user and run: observable audience situation, current problem, desired outcome, common failed approaches, acceptable fit evidence, exclusions, later-stage commercial criteria, and version. Do not reuse another user's niche assumptions.
4. Load a `VoiceContextV1` from 3-5 approved samples. If fewer than three exist, use the plain-human fallback and mark voice confidence low.
5. Search narrow phrases in this order: problem, failed attempt, stakes, desired outcome, workaround or objection. Prefer posts from the last 72 hours and reject posts older than seven days unless retained as language research only.
6. Sample the first five results. One owned, offer-mapped problem is enough to inspect; zero means rewrite one element. Stop after one qualified candidate by default, 10 rewrites, or 50 inspected results.
7. Inspect each candidate's full post, visible replies, profile, and relevant recent content. Confirm the candidate authored a concrete current problem.
8. Run hard gates before action eligibility or scoring. A high score never overrides seller-funnel, advice, stale, duplicate, suppression, profile-conflict, approval, permission, or proof rules. Having an offer is not itself a rejection.
9. Record direct evidence for situation fit, problem fit, desired-outcome fit, and at least one supporting signal: failed attempt, meaningful stakes, or genuine request for help. Solution awareness is not required.
10. Route authentic off-offer pain to adjacent research, never the active Buyer Language Bank.
11. Confirm that the public thread is safe and the proposed reply adds distinct value. A saturated or disputed thread may be `research_only` even when the person and problem are genuine.
12. Classify the candidate as `reject`, `research_only`, `public_reply_ready`, `dm_permission_ready`, `call_ready`, or `offer_ready`. Scores rank public-ready candidates and control later stages; they do not create or veto public-reply eligibility.
13. Draft through the adaptive router: clear context gets one useful mechanism, one action, and an honest tradeoff; a real evidence gap gets one diagnostic A-C-A question. The first public reply must contain no offer, link, DM ask, call ask, or paid ask.
14. With a verified logged-in browser, type the draft into the correct composer only when the user asked for staging. Stop before send and show the exact text, account, source, Offer and Voice Context versions, evidence, destination, and action.
15. Preserve staged and sent variants plus structured owner-edit dimensions. Message edits cannot mutate candidate policy.
16. Record the outcome later. A like or generic reply is not qualified progression.
17. Return a versioned receipt, including honest `no_qualified_candidate` and no-change results.

## Offer fit is user-specific

The workflow is niche-agnostic, not context-free. Every run must use the current user's Offer Context Map. A garden designer, fitness coach, accountant, author, or software consultant can qualify when their observable situation, authored problem, and desired outcome map directly to the user's offer. They do not need to know the user's mechanism yet.

## Learning rule

Qualified progression within 72 hours is the primary signal. It requires new pain, attempt, stakes, desired outcome, permission, resource acceptance, call, offer, or payment evidence.

- Fewer than 10 completed comparable outcomes: `no_change_insufficient_evidence`.
- 10 to 19 completed comparable outcomes: propose a soft rule or weight change only.
- 20 completed comparable outcomes across two batches: mark a redacted proposal `promotion_recommended` only when both batches improve qualified progression by at least 20 percentage points, false positives do not worsen, and hard-gate breaches remain zero. Public rules change only after Lennox merges the tested versioned release PR.
- Trust, consent, approval, account verification, and proof gates never self-modify.

## Public and private boundary

Public examples must be synthetic, redacted, or approved public material. Do not place private messages, member records, account identifiers, private metrics, local proof paths, credentials, or proprietary generation logic in this repo.

## Browser fallback

Threadify MCP does not claim a public outbound search or reply-send capability in this workflow. Search and composer staging use an available logged-in browser or a manual review packet. If the account cannot be verified, return `blocked_wrong_account`. If the browser is unavailable, return the exact candidate evaluation and proposed text without claiming it was staged.
