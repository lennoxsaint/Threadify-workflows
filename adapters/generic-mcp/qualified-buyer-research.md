# Generic MCP: Qualified Buyer Research

1. Load the workflow manifest and reference policy.
2. Call `get_connection_defaults` and verify the intended account separately in the browser.
3. Use approved Brain context only when available; otherwise ask for offer, audience, proof, and buyer-language inputs.
4. Search and inspect through the client's browser capability or use provided public URLs.
5. Evaluate the candidate and prepare a review packet.
6. Do not call generation or reply-send tools excluded from the public workflow.
7. If composer staging is supported, type the exact draft and stop before send.
8. Emit the workflow receipt with source, policy, stage, approval, composer, send, learning, and fallback states.
