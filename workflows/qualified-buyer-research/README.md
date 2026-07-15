# Qualified Buyer Research

Find people worth talking to without spamming strangers or walking into somebody else's funnel.

This workflow searches the words a buyer would use, checks the entire post and profile, rejects misleading candidates, classifies the next honest stage, and may stage exact copy in a browser composer. It always stops before send.

## Run order

1. Confirm the intended account with `get_connection_defaults` and visible browser identity.
2. Load only user-approved offer, audience, proof, voice, and suppression context.
3. Turn current buyer problems into narrow search phrases. Prefer posts from the last 72 hours and reject posts older than seven days unless they are explicitly retained as language research only.
4. Inspect each candidate's full post, visible replies, and profile.
5. Run hard gates before the score. A high score never overrides seller, advice, stale, duplicate, suppression, profile-conflict, approval, permission, or proof rules.
6. Classify the candidate as `reject`, `research_only`, `public_reply_ready`, `dm_permission_ready`, `call_ready`, or `offer_ready`.
7. Draft one useful non-pitch reply or the exact next eligible message.
8. With a verified logged-in browser, type the draft into the correct composer only when the user asked for staging. Stop before send and show the exact text, account, source, destination, and action.
9. Record the outcome later. A like or generic reply is not qualified progression.
10. Return a versioned receipt, including an honest no-change result when learning evidence is incomplete.

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
