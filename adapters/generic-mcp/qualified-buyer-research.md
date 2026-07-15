# Generic MCP: Qualified Buyer Research

1. Load the workflow manifest and reference policy.
2. Call `get_connection_defaults` and verify the intended account separately in the browser.
3. Use approved Brain context only when available; otherwise ask for audience, problem solved, transformation, fit evidence, exclusions, proof, and buyer-language inputs. Record them as a versioned Offer Context Map.
4. Derive searches from the current user's Offer Context Map. Check the first five results. Continue when at least one result is both an intended-problem match and first-person-owned; otherwise rewrite the query.
5. Inspect through the client's browser capability or use provided public URLs. Confirm the candidate authored the problem and inspect the full thread, profile, and relevant recent content.
6. Evaluate audience, problem, and transformation fit before scoring. Genuine pain that does not map to the user's offer is `research_only`.
7. Prepare a review packet with query quality, Offer Context Map version, fit evidence, stage, and reasons.
8. Do not call generation or reply-send tools excluded from the public workflow.
9. If composer staging is supported, type the exact draft and stop before send.
10. Emit the workflow receipt with source, policy, offer context, query quality, fit evidence, stage, approval, composer, send, learning, and fallback states.
